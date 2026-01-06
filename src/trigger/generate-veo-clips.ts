import { task, logger } from "@trigger.dev/sdk/v3";
import { db } from "@/index";
import { videoJobs, compositeImages, products, avatars } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { generateSingleVeoClipTask } from "./generate-single-veo-clip";
import type { VideoGenerationPlan } from "@/types/video-generation";

export const generateVeoClipsTask = task({
  id: "generate-veo-clips",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload: { jobId: string }) => {
    const { jobId } = payload;

    logger.info("Starting Veo clip generation", { jobId });

    const job = await db.query.videoJobs.findFirst({
      where: eq(videoJobs.id, jobId),
      with: {
        product: true,
        avatar: true,
      },
    });

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (!job.directorPlan) {
      throw new Error("Director plan not found");
    }

    const plan = job.directorPlan as unknown as VideoGenerationPlan;
    const product = job.product;
    const avatar = job.avatar;

    if (!product || !avatar) {
      throw new Error("Product or avatar not found");
    }

    if (plan.veoCalls.length === 0) {
      logger.info("No Veo clips to generate");
      await db
        .update(videoJobs)
        .set({ status: "generating_video" })
        .where(eq(videoJobs.id, jobId));
      return { generated: 0, veoClipUrls: [] };
    }

    // Check if we need composites and wait for them if they're being generated
    const needsComposites = plan.veoCalls.some(
      (call) => call.sourceImageType === "composite"
    );

    if (needsComposites) {
      const compositeIds = (job.compositeImageIds as string[]) || [];
      const completedComposites = (job.completedCompositeIds as string[]) || [];

      // Wait for composites to be generated (poll every 5 seconds, max 5 minutes)
      if (compositeIds.length === 0 || completedComposites.length < compositeIds.length) {
        logger.info("Waiting for composites to be generated...", {
          needed: compositeIds.length,
          completed: completedComposites.length,
        });

        const maxWaitTime = 5 * 60 * 1000; // 5 minutes
        const pollInterval = 5000; // 5 seconds
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
          const updatedJob = await db.query.videoJobs.findFirst({
            where: eq(videoJobs.id, jobId),
          });

          if (updatedJob) {
            const updatedCompleted = (updatedJob.completedCompositeIds as string[]) || [];
            const updatedIds = (updatedJob.compositeImageIds as string[]) || [];

            if (
              updatedIds.length > 0 &&
              updatedCompleted.length >= updatedIds.length
            ) {
              logger.info("Composites are ready, proceeding with Veo generation");
              break;
            }
          }

          await new Promise((resolve) => setTimeout(resolve, pollInterval));
        }

        // Re-fetch job to get latest composite data
        const updatedJob = await db.query.videoJobs.findFirst({
          where: eq(videoJobs.id, jobId),
        });
        if (updatedJob) {
          Object.assign(job, updatedJob);
        }
      }
    }

    // Load composite images if needed
    const compositeMap = new Map<string, string>();
    const compositeIds = (job.compositeImageIds as string[]) || [];

    if (compositeIds.length > 0) {
      const composites = await db.query.compositeImages.findMany({
        where: inArray(compositeImages.id, compositeIds),
      });

      for (let i = 0; i < composites.length; i++) {
        const composite = composites[i];
        const task = plan.imageGeneration[i];
        if (task && composite.imageUrl) {
          compositeMap.set(task.compositeId, composite.imageUrl);
        }
      }
    }

    await db
      .update(videoJobs)
      .set({ status: "generating_video" })
      .where(eq(videoJobs.id, jobId));

    // Queue all VEO clip generations with delays to respect rate limits
    // Max 2 requests per minute = at least 30 seconds between requests
    const veoTaskPromises: Promise<any>[] = [];

    logger.info(`Queueing ${plan.veoCalls.length} Veo clip generations`, {
      jobId,
    });

    for (let i = 0; i < plan.veoCalls.length; i++) {
      const veoCall = plan.veoCalls[i];

      // Resolve source image URL
      let sourceImageUrl: string;

      switch (veoCall.sourceImageType) {
        case "avatar":
          sourceImageUrl = avatar.imageUrl!;
          break;
        case "composite":
          const compositeUrl = compositeMap.get(veoCall.sourceImageRef);
          if (!compositeUrl) {
            throw new Error(
              `Composite not found: ${veoCall.sourceImageRef}. Make sure composites are generated first.`
            );
          }
          sourceImageUrl = compositeUrl;
          break;
        case "product":
          const productIndex = parseInt(veoCall.sourceImageRef.split("_")[1]) - 1;
          sourceImageUrl = (product.images as string[])[productIndex];
          break;
        default:
          throw new Error(`Unknown source type: ${veoCall.sourceImageType}`);
      }

      // Calculate delay: 30 seconds between each request to respect 2 RPM limit
      // First request starts immediately, subsequent ones are delayed
      const delayInSeconds = i * 30;

      // Trigger the individual VEO clip task with delay
      const taskPromise = generateSingleVeoClipTask.trigger({
        jobId,
        callId: veoCall.callId,
        sourceImageUrl,
        prompt: veoCall.prompt,
        delaySeconds: delayInSeconds > 0 ? delayInSeconds : undefined,
      });

      veoTaskPromises.push(taskPromise);

      logger.info(`Queued Veo clip ${i + 1}/${plan.veoCalls.length}`, {
        callId: veoCall.callId,
        delay: delayInSeconds,
      });
    }

    // Wait for all tasks to be triggered (they'll execute in the queue)
    await Promise.all(veoTaskPromises);

    logger.info("All Veo clip tasks queued", {
      count: plan.veoCalls.length,
      jobId,
    });

    // Note: The individual tasks will update the job status as they complete
    // The job status will be updated to "veo_clips_completed" when all clips are done
    return {
      queued: plan.veoCalls.length,
      message: "All Veo clip generations have been queued",
    };
  },
});

