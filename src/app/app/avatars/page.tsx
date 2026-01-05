import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/index";
import { avatars } from "@/db/schema";
import { isNull, eq, desc } from "drizzle-orm";
import { AppHeader } from "@/components/app-header";
import { AvatarsPageClient } from "./avatars-client";

export default async function AvatarsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return redirect("/sign-in");
  }

  const user = session.user;

  // Get curated avatars (where userId is null)
  const curatedAvatars = await db
    .select()
    .from(avatars)
    .where(isNull(avatars.userId))
    .orderBy(desc(avatars.createdAt));

  // Get user's avatars
  const userAvatars = await db
    .select()
    .from(avatars)
    .where(eq(avatars.userId, user.id))
    .orderBy(desc(avatars.createdAt));

  const curatedData = curatedAvatars.map((avatar) => ({
    id: avatar.id,
    imageUrl: avatar.imageUrl,
    prompt: avatar.prompt,
    createdAt: avatar.createdAt,
    updatedAt: avatar.updatedAt,
  }));

  const userData = userAvatars.map((avatar) => ({
    id: avatar.id,
    imageUrl: avatar.imageUrl,
    prompt: avatar.prompt,
    createdAt: avatar.createdAt,
    updatedAt: avatar.updatedAt,
  }));

  return (
    <>
      <AppHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Avatars" }
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                Avatars
              </h1>
            </div>
          </div>
          <AvatarsPageClient curatedAvatars={curatedData} userAvatars={userData} />
        </div>
      </div>
    </>
  );
}
