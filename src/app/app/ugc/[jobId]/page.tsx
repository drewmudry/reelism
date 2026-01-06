import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { VideoJobManager } from "./video-job-manager";
import { getVideoJob } from "@/actions/video-jobs";

export default async function VideoJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const { jobId } = await params;
  const job = await getVideoJob(jobId);

  return (
    <>
      <AppHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/app" },
          { label: "UGC Videos", href: "/app/ugc" },
          { label: `Job ${jobId.slice(0, 8)}...` },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <VideoJobManager initialJob={job} />
      </div>
    </>
  );
}

