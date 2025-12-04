import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { UserPill } from "./components/user-pill";
import { TriggerButton } from "@/components/trigger/testButton";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return redirect("/sign-in");
  }

  const user = session.user;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Dashboard
          </h1>
          <UserPill session={session} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-8 shadow-sm dark:bg-zinc-900">
          <h2 className="mb-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Welcome back, {user.name || user.email}!
          </h2>
          <p className="mb-6 text-zinc-600 dark:text-zinc-400">
            Your email is: {user.email}
          </p>
          <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <TriggerButton />
          </div>
        </div>
      </main>
    </div>
  );
}