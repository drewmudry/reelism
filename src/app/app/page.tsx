import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/index";
import { avatars } from "@/db/schema";
import { eq } from "drizzle-orm";
import { User } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return redirect("/sign-in");
  }

  const user = session.user;

  // Get user's avatar count
  const userAvatars = await db
    .select()
    .from(avatars)
    .where(eq(avatars.userId, user.id));

  const avatarCount = userAvatars.length;

  return (
    <>
      <AppHeader breadcrumbs={[{ label: "Dashboard" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
              Welcome back, {user.name || user.email}!
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              Here&apos;s an overview of your account.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Avatars
                </CardTitle>
                <User className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avatarCount}</div>
                <p className="text-xs text-muted-foreground">
                  Avatars you&apos;ve created
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
