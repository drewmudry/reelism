import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAnimations } from "@/actions/get-animations";
import { AppHeader } from "@/components/app-header";
import { AnimationsPageClient } from "./animations-client";

export default async function AnimationsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return redirect("/sign-in");
  }

  // Get curated and personal animations with avatar data
  const animationData = await getAnimations();

  return (
    <>
      <AppHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "Animations" }
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                Animations
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Animated versions of your avatars
              </p>
            </div>
          </div>
          <AnimationsPageClient animations={animationData} />
        </div>
      </div>
    </>
  );
}
