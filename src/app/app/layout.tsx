import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/index";
import { user as userTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { SubscriptionProvider } from "@/contexts/subscription-context";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return redirect("/sign-in");
  }

  const user = session.user;

  // Fetch user with subscription data - this only happens once per layout render
  // and is cached by Next.js for subsequent navigations within the app
  const currentUser = await db.query.user.findFirst({
    where: eq(userTable.id, user.id),
  });

  return (
    <SubscriptionProvider
      subscriptionStatus={currentUser?.subscriptionStatus}
      subscriptionPriceId={currentUser?.subscriptionPriceId}
    >
      <SidebarProvider>
        <AppSidebar
          user={{
            name: user.name || "User",
            email: user.email || "",
            avatar: user.image || null,
          }}
        />
        <SidebarInset>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </SubscriptionProvider>
  );
}
