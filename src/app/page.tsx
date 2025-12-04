"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  // If user is already logged in, redirect to app
  if (session && !isPending) {
    router.push("/app");
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-8 px-16 py-32">
        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-black dark:text-zinc-50 sm:text-5xl">
            Welcome to Affili8
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Your affiliate marketing platform
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <Link
            href="/sign-in"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 sm:w-auto sm:min-w-[200px]"
          >
            Get Started
          </Link>
        </div>
      </main>
    </div>
  );
}
