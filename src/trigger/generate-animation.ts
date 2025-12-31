import { task, logger } from "@trigger.dev/sdk/v3";
import { db } from "@/index";
import { animations, generations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateVideo } from "@/lib/ai";
import { uploadVideo } from "@/lib/storage";

export const generateAnimationTask = task({
  id: "generate-animation",
  maxDuration: 1200, // 20 minutes (video generation can take longer)
  run: async (payload: { generationId: string }) => {
    logger.log("Starting animation generation", { generationId: payload.generationId });

    try {
      // Fetch the generation record
      const [generation] = await db
        .select()
        .from(generations)
        .where(eq(generations.id, payload.generationId))
        .limit(1);

      if (!generation) {
        throw new Error(`Generation with id ${payload.generationId} not found`);
      }

      // Update generation status to processing
      await db
        .update(generations)
        .set({
          status: "processing",
          updatedAt: new Date(),
        })
        .where(eq(generations.id, payload.generationId));

      // Find animation linked to this generation
      const [animation] = await db
        .select()
        .from(animations)
        .where(eq(animations.generationId, payload.generationId))
        .limit(1);

      if (!animation) {
        throw new Error(`Animation with generationId ${payload.generationId} not found`);
      }

      if (animation.videoUrl) {
        logger.log("Animation already has a video URL", { animationId: animation.id });
        // Update generation status to completed
        await db
          .update(generations)
          .set({
            status: "completed",
            updatedAt: new Date(),
          })
          .where(eq(generations.id, payload.generationId));
        return { success: true, videoUrl: animation.videoUrl };
      }

      // Get the avatar image URL
      const { avatars } = await import("@/db/schema");
      const [avatar] = await db
        .select()
        .from(avatars)
        .where(eq(avatars.id, animation.avatarId))
        .limit(1);

      if (!avatar || !avatar.imageUrl) {
        throw new Error("Avatar image not found");
      }

      // Extract prompt text from generation
      const promptData = generation.prompt as any;
      const promptText = typeof generation.prompt === "string"
        ? generation.prompt
        : promptData.prompt || JSON.stringify(generation.prompt);

      logger.log("Generating video...", {
        promptLength: promptText.length,
        avatarImageUrl: avatar.imageUrl,
      });

      // IMPORTANT: Veo 3.1 preview does NOT support mixing avatar (SUBJECT) + product (ASSET) in same request
      // You can only provide multiple images of the SAME subject (up to 3 images of same person/product)
      // So we only pass the avatar image, no products
      const video = await generateVideo(promptText, avatar.imageUrl, {});

      logger.log("Video generated successfully");

      // Upload to S3
      const filename = `animations/${animation.id}.mp4`;
      logger.log("Uploading to S3...", { filename });
      const videoUrl = await uploadVideo(
        video.videoBytes,
        filename,
        "video/mp4"
      );

      logger.log("Video uploaded to S3", { videoUrl });

      // Update animation record with video URL
      await db
        .update(animations)
        .set({
          videoUrl,
          updatedAt: new Date(),
        })
        .where(eq(animations.id, animation.id));

      // Update generation status to completed
      await db
        .update(generations)
        .set({
          status: "completed",
          updatedAt: new Date(),
        })
        .where(eq(generations.id, payload.generationId));

      logger.log("Animation generation completed", {
        generationId: payload.generationId,
        animationId: animation.id,
        videoUrl
      });

      return {
        success: true,
        videoUrl,
      };
    } catch (error) {
      // Update generation status to failed
      try {
        await db
          .update(generations)
          .set({
            status: "failed",
            updatedAt: new Date(),
          })
          .where(eq(generations.id, payload.generationId));
      } catch (updateError) {
        logger.error("Failed to update generation status to failed", { error: updateError });
      }

      logger.error("Animation generation failed", {
        generationId: payload.generationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});
