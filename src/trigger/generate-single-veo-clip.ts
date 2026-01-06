import { task, logger, queue, wait } from "@trigger.dev/sdk/v3";
import { db } from "@/index";
import { videoJobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateVeoClip } from "@/lib/video-generation/veo";
import type { VideoGenerationPlan } from "@/types/video-generation";

// Create a queue for VEO generations with concurrency limit of 1
// This ensures only one VEO request processes at a time
// Combined with delays, this will respect the 2 requests per minute limit
const veoQueue = queue({
  name: "veo-generation",
  concurrencyLimit: 1, // Only one VEO request at a time
});

export const generateSingleVeoClipTask = task({
  id: "generate-single-veo-clip",
  queue: veoQueue,
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload: {
    jobId: string;
    callId: string;
    sourceImageUrl: string;
    prompt: string;
    delaySeconds?: number;
  }) => {
    const { jobId, callId, sourceImageUrl, prompt, delaySeconds } = payload;

    // Apply delay if specified (for spacing out requests to respect 2 RPM limit)
    // The queue ensures sequential execution, and delays ensure proper spacing
    if (delaySeconds && delaySeconds > 0) {
      logger.info(`Waiting ${delaySeconds} seconds before generating Veo clip`, {
        jobId,
        callId,
      });
      await wait.for({ seconds: delaySeconds });
    }

    logger.info("Generating single Veo clip", { jobId, callId });

    try {
      // Generate the Veo clip
      const { url } = await generateVeoClip({
        sourceImageUrl,
        prompt,
      });

      // Update the job with the new clip URL
      const job = await db.query.videoJobs.findFirst({
        where: eq(videoJobs.id, jobId),
      });

      if (!job) {
        throw new Error(`Job not found: ${jobId}`);
      }

      const existingUrls = (job.veoClipUrls as string[]) || [];
      const existingCompletedIds = (job.completedVeoCallIds as string[]) || [];

      // Add the new URL and mark this call as completed
      const updatedUrls = [...existingUrls, url];
      const updatedCompletedIds = [...existingCompletedIds, callId];

      // Check if all VEO calls are completed
      const plan = job.directorPlan as unknown as VideoGenerationPlan;
      const allCompleted = plan.veoCalls.every((call) =>
        updatedCompletedIds.includes(call.callId)
      );

      await db
        .update(videoJobs)
        .set({
          veoClipUrls: updatedUrls,
          completedVeoCallIds: updatedCompletedIds,
          status: allCompleted ? "veo_clips_completed" : "generating_video",
        })
        .where(eq(videoJobs.id, jobId));

      logger.info("Veo clip generated successfully", { jobId, callId, url });

      return { success: true, url, callId };
    } catch (error) {
      logger.error("Failed to generate Veo clip", { jobId, callId, error });
      throw error;
    }
  },
});

