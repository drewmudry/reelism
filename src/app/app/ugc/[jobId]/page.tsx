import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { VideoJobManager } from "./video-job-manager";
import { getVideoJob } from "@/actions/video-jobs";

export default async function VideoJobPage({
  params,
}: {
  params: { jobId: string };
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const job = await getVideoJob(params.jobId);

  return (
    <>
      <AppHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "UGC Videos", href: "/app/ugc" },
          { label: `Job ${params.jobId.slice(0, 8)}...` },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <VideoJobManager initialJob={job} />
      </div>
    </>
  );
}

