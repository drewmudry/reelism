import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/index";
import { user as userTable } from "@/db/users/schema";
import { eq } from "drizzle-orm";
import { stripe, isSubscriptionActive } from "@/lib/stripe";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ManageSubscriptionButton, SubscribeButton } from "./subscription-buttons";

interface SubscriptionPageProps {
  searchParams: Promise<{ message?: string }>;
}

export default async function SubscriptionPage({ searchParams }: SubscriptionPageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return redirect("/sign-in");
  }

  const user = session.user;
  const params = await searchParams;

  // Fetch user with subscription data - needed for detailed Stripe info
  const currentUser = await db.query.user.findFirst({
    where: eq(userTable.id, user.id),
  });

  const hasActiveSubscription = isSubscriptionActive(currentUser?.subscriptionStatus);

  // Get subscription details from Stripe if user has a subscription
  let subscriptionDetails = null;
  if (currentUser?.subscriptionId) {
    try {
      const subscriptionResponse = await stripe.subscriptions.retrieve(currentUser.subscriptionId);

      // Access current_period_end safely
      const currentPeriodEnd = (subscriptionResponse as any).current_period_end as number | undefined;
      const cancelAtPeriodEnd = (subscriptionResponse as any).cancel_at_period_end as boolean | undefined;

      // Get the price ID from the first subscription item
      let priceId: string | null = null;
      if (subscriptionResponse.items && subscriptionResponse.items.data && subscriptionResponse.items.data.length > 0) {
        const firstItem = subscriptionResponse.items.data[0];
        // Price can be a string (price ID) or a Price object
        if (typeof firstItem.price === 'string') {
          priceId = firstItem.price;
        } else if (firstItem.price && typeof firstItem.price === 'object' && 'id' in firstItem.price) {
          priceId = firstItem.price.id;
        }
      }

      const priceResponse = priceId ? await stripe.prices.retrieve(priceId) : null;
      const price = priceResponse as unknown as {
        unit_amount?: number;
        currency?: string;
        product?: string;
        recurring?: { interval: string };
      } | null;
      const productResponse = price?.product ? await stripe.products.retrieve(price.product as string) : null;
      const product = productResponse as unknown as { name?: string } | null;

      subscriptionDetails = {
        status: subscriptionResponse.status,
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
        cancelAtPeriodEnd: cancelAtPeriodEnd || false,
        productName: product?.name || "Subscription",
        priceAmount: price?.unit_amount ? price.unit_amount / 100 : null,
        priceCurrency: price?.currency?.toUpperCase() || "USD",
        interval: price?.recurring?.interval || "month",
      };
    } catch (error) {
      console.error("Error fetching subscription from Stripe:", error);
    }
  }

  return (
    <>
      <AppHeader breadcrumbs={[{ label: "Subscription" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
              Subscription
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              Manage your subscription and billing
            </p>
          </div>

          {params.message === "already_subscribed" && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4 text-blue-700 dark:text-blue-300">
              You already have an active subscription!
            </div>
          )}

          {hasActiveSubscription && subscriptionDetails ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {subscriptionDetails.productName}
                  <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:text-green-300">
                    {subscriptionDetails.status === "active" ? "Active" : subscriptionDetails.status}
                  </span>
                </CardTitle>
                <CardDescription>
                  Your current subscription plan
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Plan</p>
                    <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                      {subscriptionDetails.productName}
                    </p>
                  </div>
                  {subscriptionDetails.priceAmount && (
                    <div>
                      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Price</p>
                      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                        {subscriptionDetails.priceCurrency} {subscriptionDetails.priceAmount}/{subscriptionDetails.interval}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      {subscriptionDetails.cancelAtPeriodEnd ? "Ends on" : "Renews on"}
                    </p>
                    <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                      {subscriptionDetails.currentPeriodEnd
                        ? subscriptionDetails.currentPeriodEnd.toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Status</p>
                    <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                      {subscriptionDetails.cancelAtPeriodEnd
                        ? "Cancels at period end"
                        : "Active"}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <ManageSubscriptionButton />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Active Subscription</CardTitle>
                <CardDescription>
                  Subscribe to unlock all features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-zinc-600 dark:text-zinc-400">
                  You don&apos;t have an active subscription. Subscribe to get access to all premium features.
                </p>
                <SubscribeButton />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
