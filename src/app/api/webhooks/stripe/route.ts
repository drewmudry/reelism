import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/index";
import { user as userTable } from "@/db/users/schema";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(`Webhook signature verification failed: ${errorMessage}`);
    return NextResponse.json(
      { error: `Webhook Error: ${errorMessage}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`Error processing webhook ${event?.type || "unknown"}: ${errorMessage}`, stack);
    return NextResponse.json(
      { error: `Webhook handler error: ${errorMessage}` },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId) {
    console.error("No userId in checkout session metadata");
    return;
  }

  if (!subscriptionId) {
    console.error("No subscription ID in checkout session");
    return;
  }

  try {
    // Verify user exists first
    const user = await db.query.user.findFirst({
      where: eq(userTable.id, userId),
    });

    if (!user) {
      console.error(`User ${userId} not found in database`);
      return;
    }

    // Fetch the subscription details
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Get the price ID from the first subscription item
    let priceId: string | null = null;
    if (subscription.items && subscription.items.data && subscription.items.data.length > 0) {
      const firstItem = subscription.items.data[0];
      // Price can be a string (price ID) or a Price object
      if (typeof firstItem.price === 'string') {
        priceId = firstItem.price;
      } else if (firstItem.price && typeof firstItem.price === 'object' && 'id' in firstItem.price) {
        priceId = firstItem.price.id;
      }
    }

    // Access current_period_end safely
    const currentPeriodEnd = (subscription as any).current_period_end as number | undefined;

    // Update user with subscription info
    await db
      .update(userTable)
      .set({
        stripeCustomerId: customerId,
        subscriptionId: subscriptionId,
        subscriptionStatus: subscription.status,
        subscriptionPriceId: priceId,
        subscriptionCurrentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
      })
      .where(eq(userTable.id, userId));

    console.log(`Checkout completed for user ${userId}, subscription ${subscriptionId}`);
  } catch (error) {
    console.error(`Error handling checkout completed for user ${userId}: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
    throw error;
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  // Access metadata before casting
  const metadata = subscription.metadata;
  const userIdFromMetadata = metadata?.userId;
  
  let existingUser;

  // Try to find user by Stripe customer ID first
  existingUser = await db.query.user.findFirst({
    where: eq(userTable.stripeCustomerId, customerId),
  });

  // If not found, try to find by userId from subscription metadata (for newly created subscriptions)
  if (!existingUser && userIdFromMetadata) {
    existingUser = await db.query.user.findFirst({
      where: eq(userTable.id, userIdFromMetadata),
    });
    
    // If found by userId, update the stripeCustomerId
    if (existingUser) {
      await db
        .update(userTable)
        .set({ stripeCustomerId: customerId })
        .where(eq(userTable.id, existingUser.id));
    }
  }

  // If still not found, try to get customer from Stripe and find by email
  if (!existingUser) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (customer && !customer.deleted && typeof customer === "object" && "email" in customer) {
        const customerEmail = (customer as Stripe.Customer).email;
        if (customerEmail) {
          existingUser = await db.query.user.findFirst({
            where: eq(userTable.email, customerEmail),
          });
          
          // If found by email, update the stripeCustomerId
          if (existingUser) {
            await db
              .update(userTable)
              .set({ stripeCustomerId: customerId })
              .where(eq(userTable.id, existingUser.id));
          }
        }
      }
    } catch (error) {
      console.error(`Error retrieving customer ${customerId}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  if (!existingUser) {
    console.error(`No user found for customer ${customerId}`);
    return;
  }

  try {
    // Get the price ID from the first subscription item
    let priceId: string | null = null;
    if (subscription.items && subscription.items.data && subscription.items.data.length > 0) {
      const firstItem = subscription.items.data[0];
      // Price can be a string (price ID) or a Price object
      if (typeof firstItem.price === 'string') {
        priceId = firstItem.price;
      } else if (firstItem.price && typeof firstItem.price === 'object' && 'id' in firstItem.price) {
        priceId = firstItem.price.id;
      }
    }

    // Access current_period_end safely
    const currentPeriodEnd = (subscription as any).current_period_end as number | undefined;

    // Update subscription info
    await db
      .update(userTable)
      .set({
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        subscriptionPriceId: priceId,
        subscriptionCurrentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
      })
      .where(eq(userTable.id, existingUser.id));

    console.log(`Subscription updated for user ${existingUser.id}: ${subscription.status}`);
  } catch (error) {
    console.error(`Error updating subscription: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
    throw error;
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Find user by Stripe customer ID
  const existingUser = await db.query.user.findFirst({
    where: eq(userTable.stripeCustomerId, customerId),
  });

  if (!existingUser) {
    console.error(`No user found for customer ${customerId}`);
    return;
  }

  // Clear subscription info but keep customer ID
  await db
    .update(userTable)
    .set({
      subscriptionId: null,
      subscriptionStatus: "canceled",
      subscriptionPriceId: null,
      subscriptionCurrentPeriodEnd: null,
    })
    .where(eq(userTable.id, existingUser.id));

  console.log(`Subscription canceled for user ${existingUser.id}`);
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  // Cast invoice to access subscription property
  const inv = invoice as unknown as { subscription?: string };
  const subscriptionId = inv.subscription;

  if (!subscriptionId) {
    // One-time payment, not a subscription
    return;
  }

  // Find user by Stripe customer ID
  const existingUser = await db.query.user.findFirst({
    where: eq(userTable.stripeCustomerId, customerId),
  });

  if (!existingUser) {
    console.error(`No user found for customer ${customerId}`);
    return;
  }

  // Fetch the subscription to get updated period end
  const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId);
  const subscription = subscriptionResponse as unknown as {
    status: string;
    current_period_end: number;
  };

  // Update subscription period end
  await db
    .update(userTable)
    .set({
      subscriptionStatus: subscription.status,
      subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
    })
    .where(eq(userTable.id, existingUser.id));

  console.log(`Invoice payment succeeded for user ${existingUser.id}`);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  // Cast invoice to access subscription property
  const inv = invoice as unknown as { subscription?: string };
  const subscriptionId = inv.subscription;

  if (!subscriptionId) {
    return;
  }

  // Find user by Stripe customer ID
  const existingUser = await db.query.user.findFirst({
    where: eq(userTable.stripeCustomerId, customerId),
  });

  if (!existingUser) {
    console.error(`No user found for customer ${customerId}`);
    return;
  }

  // Update subscription status to past_due
  await db
    .update(userTable)
    .set({
      subscriptionStatus: "past_due",
    })
    .where(eq(userTable.id, existingUser.id));

  console.log(`Invoice payment failed for user ${existingUser.id}`);
}
