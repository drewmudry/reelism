import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/index";
import { user as userTable } from "@/db/users/schema";
import { eq } from "drizzle-orm";
import { stripe, SUBSCRIPTION_PLANS, getPriceId, type SubscriptionPlan, type BillingInterval } from "@/lib/stripe";

interface CheckoutPageProps {
  searchParams: Promise<{ plan?: string; interval?: string }>;
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const params = await searchParams;
  const plan = (params.plan || "pro") as SubscriptionPlan;
  const interval = (params.interval || "monthly") as BillingInterval;

  // Validate that the plan exists
  if (!SUBSCRIPTION_PLANS[plan]) {
    return redirect("/app/billing?error=invalid_plan");
  }

  // If not logged in, redirect to sign-in with callback to checkout
  if (!session) {
    const callbackUrl = encodeURIComponent(`/checkout?plan=${plan}&interval=${interval}`);
    return redirect(`/sign-in?callbackUrl=${callbackUrl}`);
  }

  const userId = session.user.id;

  // Fetch the current user from the database
  const currentUser = await db.query.user.findFirst({
    where: eq(userTable.id, userId),
  });

  if (!currentUser) {
    return redirect("/sign-in");
  }

  // Get or create Stripe customer ID
  let customerId = currentUser.stripeCustomerId;

  if (!customerId) {
    // Create Stripe customer
    const customer = await stripe.customers.create({
      email: session.user.email,
      name: session.user.name || undefined,
      metadata: { userId },
    });

    customerId = customer.id;

    // Save the Stripe customer ID to the database
    await db
      .update(userTable)
      .set({ stripeCustomerId: customerId })
      .where(eq(userTable.id, userId));
  }

  // Get the price ID for the selected plan and interval
  const priceId = getPriceId(plan, interval);
  if (!priceId) {
    // If price ID not configured, redirect to billing page
    return redirect("/app/billing?error=price_not_configured");
  }

  // Check if user already has an active subscription
  if (currentUser.subscriptionStatus === "active" || currentUser.subscriptionStatus === "trialing") {
    // Redirect to billing page for upgrade/change options
    return redirect("/app/billing?message=already_subscribed");
  }

  // Create Stripe Checkout Session
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${process.env.BETTER_AUTH_URL}/app?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.BETTER_AUTH_URL}/app/billing?canceled=true`,
    metadata: {
      userId,
      plan,
      interval,
    },
    subscription_data: {
      metadata: {
        userId,
        plan,
        interval,
      },
    },
    // Allow promotion codes
    allow_promotion_codes: true,
    // Collect billing address
    billing_address_collection: "auto",
  });

  // Redirect to Stripe Checkout
  if (checkoutSession.url) {
    return redirect(checkoutSession.url);
  }

  // Fallback if no URL (shouldn't happen)
  return redirect("/app/billing?error=checkout_failed");
}
