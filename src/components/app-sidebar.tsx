"use client"

import * as React from "react"
import { User, Package, Video, Film } from "lucide-react"
import Link from "next/link"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: {
    name: string;
    email: string;
    avatar?: string | null;
  };
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const navMain = [
    {
      title: "Avatars",
      url: "/app/avatars",
      icon: User,
      isActive: false,
      items: [],
    },
    {
      title: "Animations",
      url: "/app/animations",
      icon: Film,
      isActive: false,
      items: [],
    },
    {
      title: "Products",
      url: "/app/products",
      icon: Package,
      isActive: false,
      items: [],
    },
    {
      title: "Demos",
      url: "/app/demos",
      icon: Video,
      isActive: false,
      items: [],
    },
  ];

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Link href="/app" className="flex items-center gap-2 px-2 py-2 hover:opacity-80 transition-opacity">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <User className="h-4 w-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-semibold">Reelism</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={{
          name: user.name,
          email: user.email,
          avatar: user.avatar || undefined,
        }} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
