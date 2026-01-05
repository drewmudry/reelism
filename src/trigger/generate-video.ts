import { task, logger } from "@trigger.dev/sdk/v3";
import { db } from "@/index";
import {
  videoJobs,
  compositeImages,
  indexedClips,
  products,
  avatars,
  demos,
} from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { callDirector } from "@/lib/video-generation/director";
import { validatePlan } from "@/lib/video-generation/validation";
import { generateCompositeImage } from "@/lib/video-generation/composite";
import { generateVeoClip } from "@/lib/video-generation/veo";
import { assembleVideo } from "@/lib/video-generation/assembly";
import { uploadToStorage } from "@/lib/video-generation/storage-helper";
import type { DirectorInput, VideoGenerationPlan } from "@/types/video-generation";

export const generateVideoTask = task({
  id: "generate-video",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload: { jobId: string }) => {
    const { jobId } = payload;

    // =========================================
    // STEP 1: Load job and related data
    // =========================================
    logger.info("Loading job data", { jobId });

    const job = await db.query.videoJobs.findFirst({
      where: eq(videoJobs.id, jobId),
    });

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const product = await db.query.products.findFirst({
      where: eq(products.id, job.productId),
    });

    const avatar = await db.query.avatars.findFirst({
      where: eq(avatars.id, job.avatarId),
    });

    if (!product || !avatar) {
      throw new Error("Product or avatar not found");
    }

    const jobDemos =
      job.demoIds.length > 0
        ? await db.query.demos.findMany({
            where: inArray(demos.id, job.demoIds),
          })
        : [];

    // Fetch existing indexed clips for this product (for reuse)
    const existingClips = await db.query.indexedClips.findMany({
      where: eq(indexedClips.productId, job.productId),
      orderBy: [desc(indexedClips.usageCount)],
      limit: 10,
    });

    try {
      // =========================================
      // STEP 2: Call Creative Director
      // =========================================
      await updateJobStatus(jobId, "planning");
      logger.info("Calling Creative Director agent");

      const directorInput: DirectorInput = {
        product: {
          id: product.id,
          name: product.title || "Untitled Product",
          price: product.price ? Number(product.price) : null,
          description: product.description || null,
          hooks: (product.hooks as string[]) || [],
          images: (product.images as string[]) || [],
        },
        avatar: {
          id: avatar.id,
          imageUrl: avatar.imageUrl!,
        },
        demos: jobDemos.map((d) => ({
          id: d.id,
          description: d.description || null,
        })),
        existingClips: existingClips.map((c) => ({
          id: c.id,
          description: c.description,
          duration: c.duration,
          type: c.type,
        })),
        preferences: {
          tone: job.tone,
          // Director will choose optimal duration (16-24 seconds) to maximize Veo clip utilization
          targetDuration: 24 as 16 | 20 | 24, // Not used - director chooses duration in plan
        },
      };

      const plan = await callDirector(directorInput);

      // Validate the plan
      const validation = validatePlan(plan, directorInput);
      if (!validation.valid) {
        throw new Error(`Director plan validation failed: ${validation.errors.join(", ")}`);
      }

      if (validation.warnings.length > 0) {
        logger.warn("Director plan warnings", { warnings: validation.warnings });
      }

      // Store the plan and update targetDuration with director's choice
      await db
        .update(videoJobs)
        .set({ 
          directorPlan: plan,
          targetDuration: plan.totalDuration, // Use director's chosen duration
        })
        .where(eq(videoJobs.id, jobId));

      logger.info("Director plan stored", {
        totalDuration: plan.totalDuration,
        segmentCount: plan.segments.length,
        veoCallCount: plan.veoCalls.length,
        compositeCount: plan.imageGeneration.length,
      });

      // =========================================
      // STEP 3: Generate Composite Images
      // =========================================
      await updateJobStatus(jobId, "generating_composites");

      const compositeMap = new Map<string, string>(); // compositeId -> imageUrl

      if (plan.imageGeneration.length > 0) {
        logger.info("Generating composite images", { count: plan.imageGeneration.length });

        const compositeResults = await Promise.all(
          plan.imageGeneration.map(async (task) => {
            // Get product image URLs for the referenced indices
            const productImageUrls = task.productSources.map((ref) => {
              const index = parseInt(ref.split("_")[1]) - 1;
              return (product.images as string[])[index];
            });

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

            return { compositeId: task.compositeId, dbId: composite.id, imageUrl };
          })
        );

        // Build lookup map and store IDs
        const compositeDbIds: string[] = [];
        for (const result of compositeResults) {
          compositeMap.set(result.compositeId, result.imageUrl);
          compositeDbIds.push(result.dbId);
        }

        await db
          .update(videoJobs)
          .set({ compositeImageIds: compositeDbIds })
          .where(eq(videoJobs.id, jobId));
      }

      // =========================================
      // STEP 4: Generate Veo Video Clips
      // =========================================
      await updateJobStatus(jobId, "generating_video");
      logger.info("Generating Veo clips", { count: plan.veoCalls.length });

      const veoClipMap = new Map<string, { url: string; buffer: Buffer }>();

      const veoResults = await Promise.all(
        plan.veoCalls.map(async (veoCall) => {
          // Resolve source image URL
          let sourceImageUrl: string;

          switch (veoCall.sourceImageType) {
            case "avatar":
              sourceImageUrl = avatar.imageUrl!;
              break;
            case "composite":
              sourceImageUrl = compositeMap.get(veoCall.sourceImageRef)!;
              if (!sourceImageUrl) {
                throw new Error(`Composite not found: ${veoCall.sourceImageRef}`);
              }
              break;
            case "product":
              const productIndex = parseInt(veoCall.sourceImageRef.split("_")[1]) - 1;
              sourceImageUrl = (product.images as string[])[productIndex];
              break;
            default:
              throw new Error(`Unknown source type: ${veoCall.sourceImageType}`);
          }

          const { url, buffer } = await generateVeoClip({
            sourceImageUrl,
            prompt: veoCall.prompt,
          });

          return { callId: veoCall.callId, url, buffer };
        })
      );

      // Build lookup map
      const veoClipUrls: string[] = [];
      for (const result of veoResults) {
        veoClipMap.set(result.callId, { url: result.url, buffer: result.buffer });
        veoClipUrls.push(result.url);
      }

      await db
        .update(videoJobs)
        .set({ veoClipUrls })
        .where(eq(videoJobs.id, jobId));

      // =========================================
      // STEP 5: Assemble Final Video
      // =========================================
      await updateJobStatus(jobId, "assembling");
      logger.info("Assembling final video");

      // Fetch demo videos if needed
      const demoMap = new Map<string, string>();
      for (const demo of jobDemos) {
        demoMap.set(demo.id, demo.url);
      }

      // Fetch existing indexed clips if referenced
      const existingClipMap = new Map<string, string>();
      const referencedClipIds = plan.segments.filter((s) => s.existingClipId).map((s) => s.existingClipId!);

      if (referencedClipIds.length > 0) {
        const clips = await db.query.indexedClips.findMany({
          where: inArray(indexedClips.id, referencedClipIds),
        });
        for (const clip of clips) {
          existingClipMap.set(clip.id, clip.fileUrl);

          // Update usage count
          await db
            .update(indexedClips)
            .set({
              usageCount: clip.usageCount + 1,
              lastUsedAt: new Date(),
            })
            .where(eq(indexedClips.id, clip.id));
        }
      }

      const finalVideoBuffer = await assembleVideo({
        plan,
        veoClipMap,
        demoMap,
        existingClipMap,
      });

      // Upload final video
      const finalVideoUrl = await uploadToStorage(
        finalVideoBuffer,
        `videos/${job.userId}/${jobId}/final.mp4`,
        "video/mp4"
      );

      // =========================================
      // STEP 6: Index Reusable Clips
      // =========================================
      logger.info("Indexing reusable clips");

      await indexReusableClips({
        plan,
        veoClipMap,
        job,
        product,
      });

      // =========================================
      // STEP 7: Mark Complete
      // =========================================
      await db
        .update(videoJobs)
        .set({
          status: "completed",
          finalVideoUrl,
          finalDuration: plan.totalDuration,
          updatedAt: new Date(),
        })
        .where(eq(videoJobs.id, jobId));

      logger.info("Video generation completed", { finalVideoUrl });

      return { success: true, finalVideoUrl };
    } catch (error) {
      logger.error("Video generation failed", { error });

      const job = await db.query.videoJobs.findFirst({
        where: eq(videoJobs.id, jobId),
      });

      await db
        .update(videoJobs)
        .set({
          status: "failed",
          error: (error as Error).message,
          errorStep: job?.status || "unknown",
          updatedAt: new Date(),
        })
        .where(eq(videoJobs.id, jobId));

      throw error;
    }
  },
});

async function updateJobStatus(jobId: string, status: string) {
  await db
    .update(videoJobs)
    .set({ status, updatedAt: new Date() })
    .where(eq(videoJobs.id, jobId));
}

async function indexReusableClips(params: {
  plan: VideoGenerationPlan;
  veoClipMap: Map<string, { url: string; buffer: Buffer }>;
  job: any;
  product: any;
}) {
  const { plan, veoClipMap, job, product } = params;

  // Find segments worth indexing
  const indexableSegments = plan.segments.filter(
    (segment) =>
      (segment.type === "virtual_broll" || segment.type === "product_broll") &&
      !segment.existingClipId &&
      segment.veoCallId
  );

  for (const segment of indexableSegments) {
    const veoClip = veoClipMap.get(segment.veoCallId!);
    if (!veoClip) continue;

    const veoCall = plan.veoCalls.find((v) => v.callId === segment.veoCallId);
    if (!veoCall) continue;

    // For now, just index the full clip
    // TODO: Extract segment if startTime !== 0 || endTime !== 8
    const clipUrl = veoClip.url;

    // Generate thumbnail
    const thumbnailUrl = await generateThumbnail(veoClip.buffer, product.id);

    await db.insert(indexedClips).values({
      userId: job.userId,
      avatarId: veoCall.sourceImageType === "avatar" ? job.avatarId : null,
      productId: product.id,
      compositeImageId: null,
      type: segment.type,
      duration: segment.endTime - segment.startTime,
      description: segment.brollPrompt || "Product B-roll",
      script: null,
      veoPrompt: veoCall.prompt,
      audioMood: extractAudioMood(veoCall.prompt),
      fileUrl: clipUrl,
      thumbnailUrl,
      usageCount: 1,
      lastUsedAt: new Date(),
    });
  }
}

function extractAudioMood(prompt: string): string | null {
  const moodKeywords = ["upbeat", "calm", "energetic", "soft", "aesthetic", "dramatic", "peaceful"];
  const promptLower = prompt.toLowerCase();
  for (const mood of moodKeywords) {
    if (promptLower.includes(mood)) return mood;
  }
  return null;
}

async function generateThumbnail(videoBuffer: Buffer, productId: string): Promise<string> {
  // TODO: Implement thumbnail generation with ffmpeg
  // For now, return placeholder
  return `https://placeholder.com/thumbnail-${productId}.jpg`;
}

