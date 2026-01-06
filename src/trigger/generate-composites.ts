import { task, logger } from "@trigger.dev/sdk/v3";
import { db } from "@/index";
import { videoJobs, compositeImages, products, avatars } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateCompositeImage } from "@/lib/video-generation/composite";
import type { VideoGenerationPlan } from "@/types/video-generation";

export const generateCompositesTask = task({
  id: "generate-composites",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload: { jobId: string }) => {
    const { jobId } = payload;

    logger.info("Starting composite generation", { jobId });

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

    if (plan.imageGeneration.length === 0) {
      logger.info("No composite images to generate");
      await db
        .update(videoJobs)
        .set({ status: "generating_composites" })
        .where(eq(videoJobs.id, jobId));
      return { generated: 0, compositeIds: [] };
    }

    await db
      .update(videoJobs)
      .set({ status: "generating_composites" })
      .where(eq(videoJobs.id, jobId));

    const compositeDbIds: string[] = [];
    const completedIds: string[] = [];

    // Generate composites sequentially
    for (let i = 0; i < plan.imageGeneration.length; i++) {
      const task = plan.imageGeneration[i];
      logger.info(`Generating composite ${i + 1}/${plan.imageGeneration.length}`, {
        compositeId: task.compositeId,
      });

      // Get product image URLs
      const productImageUrls = task.productSources.map((ref) => {
        const index = parseInt(ref.split("_")[1]) - 1;
        return (product.images as string[])[index];
      });

      // Generate the composite image
      const imageUrl = await generateCompositeImage({
        avatarImageUrl: avatar.imageUrl!,
        productImageUrls,
        prompt: task.prompt,
      });

      // Store in database
      const [composite] = await db
        .insert(compositeImages)
        .values({
          userId: job.userId,
          avatarId: avatar.id,
          productId: product.id,
          productImageIndices: task.productSources.map((ref) => parseInt(ref.split("_")[1]) - 1),
          prompt: task.prompt,
          description: task.description,
          imageUrl,
        })
        .returning();

      compositeDbIds.push(composite.id);
      completedIds.push(composite.id);

      logger.info(`Completed composite ${i + 1}/${plan.imageGeneration.length}`, {
        compositeId: composite.id,
      });
    }

    // Update job with composite IDs and completion tracking
    await db
      .update(videoJobs)
      .set({
        compositeImageIds: compositeDbIds,
        completedCompositeIds: completedIds,
        status: "composites_completed",
      })
      .where(eq(videoJobs.id, jobId));

    logger.info("All composites generated", {
      count: compositeDbIds.length,
      jobId,
    });

    return {
      generated: compositeDbIds.length,
      compositeIds: compositeDbIds,
    };
  },
});

