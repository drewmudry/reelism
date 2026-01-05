"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ManageSubscriptionButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleManageSubscription = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
      });
      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("No portal URL returned");
      }
    } catch (error) {
      console.error("Error creating portal session:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleManageSubscription}
      disabled={isLoading}
      variant="outline"
    >
      {isLoading ? "Loading..." : "Manage Subscription"}
    </Button>
  );
}

export function SubscribeButton() {
  const router = useRouter();

  const handleSubscribe = () => {
    router.push("/app/billing");
  };

  return (
    <Button onClick={handleSubscribe}>
      View Plans
    </Button>
  );
}
