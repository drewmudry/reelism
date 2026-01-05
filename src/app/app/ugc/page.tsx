import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { UGCClient } from "./ugc-client";
import { getUserVideoJobs } from "@/actions/video-jobs";

export default async function UGCPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const jobs = await getUserVideoJobs();

  return (
    <>
      <AppHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "UGC Videos" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <UGCClient initialJobs={jobs} />
      </div>
    </>
  );
}

