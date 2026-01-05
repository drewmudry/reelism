"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Plan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  popular?: boolean;
}

interface BillingClientProps {
  plans: Plan[];
  currentPlan: string | null;
  currentInterval: "monthly" | "yearly" | null;
  hasActiveSubscription: boolean;
}

export function BillingClient({
  plans,
  currentPlan,
  currentInterval,
  hasActiveSubscription,
}: BillingClientProps) {
  const router = useRouter();
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">(
    currentInterval || "monthly"
  );
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleSelectPlan = async (planId: string) => {
    if (hasActiveSubscription && planId === currentPlan) {
      // If already on this plan, go to subscription management
      handleManageSubscription();
      return;
    }

    setIsLoading(planId);
    // Navigate to checkout with plan and interval
    router.push(`/checkout?plan=${planId}&interval=${billingInterval}`);
  };

  const handleManageSubscription = async () => {
    setIsLoading("manage");
    try {
      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
      });
      const data = await response.json();

      if (data.url) {
        window.location.assign(data.url);
      } else {
        console.error("No portal URL returned");
        setIsLoading(null);
      }
    } catch (error) {
      console.error("Error creating portal session:", error);
      setIsLoading(null);
    }
  };

  const getButtonText = (plan: Plan) => {
    if (isLoading === plan.id) return "Loading...";
    if (hasActiveSubscription && plan.id === currentPlan) {
      return "Current Plan";
    }
    if (hasActiveSubscription) {
      return "Change Plan";
    }
    return "Get Started";
  };

  const getButtonVariant = (plan: Plan): "default" | "outline" => {
    if (hasActiveSubscription && plan.id === currentPlan) {
      return "outline";
    }
    return plan.popular ? "default" : "outline";
  };

  const yearlyDiscount = (plan: Plan) => {
    const monthlyTotal = plan.monthlyPrice * 12;
    const savings = monthlyTotal - plan.yearlyPrice;
    const percentOff = Math.round((savings / monthlyTotal) * 100);
    return percentOff;
  };

  return (
    <div className="space-y-8">
      {/* Billing Interval Toggle */}
      <div className="flex justify-center">
        <Tabs
          value={billingInterval}
          onValueChange={(value) => setBillingInterval(value as "monthly" | "yearly")}
        >
          <TabsList className="grid w-[300px] grid-cols-2">
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly" className="relative">
              Yearly
              <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                Save 17%
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Plans Grid */}
      <div className={cn(
        "grid gap-6 mx-auto",
        plans.length === 1 && "grid-cols-1 max-w-md",
        plans.length === 2 && "grid-cols-1 md:grid-cols-2 max-w-3xl",
        plans.length >= 3 && "grid-cols-1 md:grid-cols-3 max-w-6xl"
      )}>
        {plans.map((plan) => {
          const isCurrentPlan = hasActiveSubscription && plan.id === currentPlan;
          const price = billingInterval === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
          const displayPrice = billingInterval === "yearly" ? Math.round(plan.yearlyPrice / 12) : price;

          return (
            <Card
              key={plan.id}
              className={cn(
                "relative flex flex-col",
                plan.popular && "border-primary shadow-lg",
                isCurrentPlan && "ring-2 ring-green-500"
              )}
            >
              {plan.popular && !isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Most Popular
                  </span>
                </div>
              )}
              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Current Plan
                  </span>
                </div>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="text-center mb-6">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">${displayPrice}</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                  {billingInterval === "yearly" && (
                    <p className="text-sm text-muted-foreground mt-1">
                      ${plan.yearlyPrice}/year (save {yearlyDiscount(plan)}%)
                    </p>
                  )}
                </div>
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={getButtonVariant(plan)}
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={isLoading !== null}
                >
                  {getButtonText(plan)}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Manage Subscription Button for existing subscribers */}
      {hasActiveSubscription && (
        <div className="text-center pt-4 border-t">
          <p className="text-sm text-muted-foreground mb-4">
            Need to update your payment method or cancel your subscription?
          </p>
          <Button
            variant="outline"
            onClick={handleManageSubscription}
            disabled={isLoading !== null}
          >
            {isLoading === "manage" ? "Loading..." : "Manage Subscription"}
          </Button>
        </div>
      )}
    </div>
  );
}
