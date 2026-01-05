"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useSubscription } from "@/contexts/subscription-context"

interface AppHeaderProps {
  breadcrumbs: Array<{
    label: string
    href?: string
  }>
}

export function AppHeader({ breadcrumbs }: AppHeaderProps) {
  const router = useRouter()
  const { showUpgradeButton } = useSubscription()

  const handleUpgrade = () => {
    router.push("/app/billing")
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4 flex-1">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => (
              <div key={index} className="flex items-center gap-2">
                {index > 0 && <BreadcrumbSeparator className="hidden md:block" />}
                <BreadcrumbItem className={index === 0 ? "" : "hidden md:block"}>
                  {crumb.href ? (
                    <BreadcrumbLink href={crumb.href}>
                      {crumb.label}
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </div>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      {showUpgradeButton && (
        <div className="px-4">
          <Button onClick={handleUpgrade} size="sm" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Upgrade to Pro
          </Button>
        </div>
      )}
    </header>
  )
}

