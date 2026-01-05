import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/index";
import { user as userTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AppHeader } from "@/components/app-header";
import { BillingClient } from "./billing-client";
import { SUBSCRIPTION_PLANS, getPlanFromPriceId, isSubscriptionActive } from "@/lib/stripe";

export default async function BillingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return redirect("/sign-in");
  }

  const user = session.user;

  // Fetch user with subscription data
  const currentUser = await db.query.user.findFirst({
    where: eq(userTable.id, user.id),
  });

  const hasActiveSubscription = isSubscriptionActive(currentUser?.subscriptionStatus);

  // Determine current plan and interval from price ID
  let currentPlan: string | null = null;
  let currentInterval: "monthly" | "yearly" | null = null;

  if (hasActiveSubscription && currentUser?.subscriptionPriceId) {
    const planInfo = getPlanFromPriceId(currentUser.subscriptionPriceId);
    if (planInfo) {
      currentPlan = planInfo.plan;
      currentInterval = planInfo.interval;
    }
  }

  // Transform plans data for client component
  const plansData = Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => ({
    id: key,
    name: plan.name,
    description: plan.description,
    monthlyPrice: plan.prices.monthly.amount,
    yearlyPrice: plan.prices.yearly.amount,
    features: [...plan.features],
    popular: 'popular' in plan ? plan.popular : false,
  }));

  return (
    <>
      <AppHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Billing" }
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              Billing & Plans
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 mt-2">
              Choose the plan that best fits your needs
            </p>
          </div>
          <BillingClient
            plans={plansData}
            currentPlan={currentPlan}
            currentInterval={currentInterval}
            hasActiveSubscription={hasActiveSubscription}
          />
        </div>
      </div>
    </>
  );
}
