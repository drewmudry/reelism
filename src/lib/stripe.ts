import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    "STRIPE_SECRET_KEY environment variable is required. Set it in your .env file."
  );
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Billing interval types
export type BillingInterval = "monthly" | "yearly";

// Price IDs for subscription plans - configure these in your Stripe dashboard
// and add them to your environment variables
export const SUBSCRIPTION_PLANS = {
  starter: {
    name: "Starter",
    description: "Perfect for individuals getting started",
    prices: {
      monthly: {
        priceId: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || "",
        amount: 50,
        currency: "USD",
      },
      yearly: {
        priceId: process.env.STRIPE_STARTER_YEARLY_PRICE_ID || "",
        amount: 500, // 2 months free
        currency: "USD",
      },
    },
    features: [
      "5 AI avatars per month",
      "20 UGC videos per month",
    ],
  },
  pro: {
    name: "Pro",
    description: "For professionals and growing teams",
    prices: {
      monthly: {
        priceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "",
        amount: 100,
        currency: "USD",
      },
      yearly: {
        priceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID || "",
        amount: 1000, // 2 months free
        currency: "USD",
      },
    },
    features: [
      "50 AI avatars per month",
      "60 UGC videos per month",

    ],
    popular: true,
  }
} as const;

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLANS;

// Helper to get price ID for a plan and interval
export function getPriceId(plan: SubscriptionPlan, interval: BillingInterval): string {
  return SUBSCRIPTION_PLANS[plan].prices[interval].priceId;
}

// Helper to get plan details from a price ID
export function getPlanFromPriceId(priceId: string): { plan: SubscriptionPlan; interval: BillingInterval } | null {
  for (const [planKey, planData] of Object.entries(SUBSCRIPTION_PLANS)) {
    if (planData.prices.monthly.priceId === priceId) {
      return { plan: planKey as SubscriptionPlan, interval: "monthly" };
    }
    if (planData.prices.yearly.priceId === priceId) {
      return { plan: planKey as SubscriptionPlan, interval: "yearly" };
    }
  }
  return null;
}

// Helper to check if a subscription status is considered "active"
export function isSubscriptionActive(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

// Legacy support: Get the first available price ID for a plan (monthly)
// This maintains backward compatibility with the old priceId property
export function getLegacyPriceId(plan: SubscriptionPlan): string {
  return SUBSCRIPTION_PLANS[plan].prices.monthly.priceId;
}
