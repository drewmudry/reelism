"use client"

import { createContext, useContext, ReactNode } from "react"

export type SubscriptionTier = "Starter" | "Pro" | "Enterprise" | null

export interface SubscriptionData {
  subscriptionStatus: string | null
  subscriptionPriceId: string | null
  isActive: boolean
  tier: SubscriptionTier
  showUpgradeButton: boolean
}

const SubscriptionContext = createContext<SubscriptionData | null>(null)

interface SubscriptionProviderProps {
  children: ReactNode
  subscriptionStatus: string | null | undefined
  subscriptionPriceId: string | null | undefined
}

export function SubscriptionProvider({
  children,
  subscriptionStatus,
  subscriptionPriceId,
}: SubscriptionProviderProps) {
  // Determine if subscription is active
  const isActive = subscriptionStatus === "active" || subscriptionStatus === "trialing"

  // Determine subscription tier based on price ID
  let tier: SubscriptionTier = null
  if (isActive && subscriptionPriceId) {
    const priceIdLower = subscriptionPriceId.toLowerCase()
    if (priceIdLower.includes("enterprise")) {
      tier = "Enterprise"
    } else if (priceIdLower.includes("starter")) {
      tier = "Starter"
    } else {
      // Default to Pro for any other active subscription
      tier = "Pro"
    }
  }

  const value: SubscriptionData = {
    subscriptionStatus: subscriptionStatus ?? null,
    subscriptionPriceId: subscriptionPriceId ?? null,
    isActive,
    tier,
    showUpgradeButton: !isActive,
  }

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription(): SubscriptionData {
  const context = useContext(SubscriptionContext)
  if (!context) {
    throw new Error("useSubscription must be used within a SubscriptionProvider")
  }
  return context
}

// Optional hook that doesn't throw if outside provider (useful for optional subscription checks)
export function useSubscriptionOptional(): SubscriptionData | null {
  return useContext(SubscriptionContext)
}
