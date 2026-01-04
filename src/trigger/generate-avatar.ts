import { task, logger } from "@trigger.dev/sdk/v3";
import { db } from "@/index";
import { avatars, generations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateImage, generateImageFromReference } from "@/lib/ai";
import { uploadImage } from "@/lib/storage";
import { RemixOptions } from "@/lib/remix-options";

/**
 * Converts a complex prompt object to a text description for image generation
 */
function promptToText(prompt: any): string {
  // If it's already a string, return it
  if (typeof prompt === "string") {
    return prompt;
  }

  // If it has a "prompt" field, use that
  if (prompt.prompt && typeof prompt.prompt === "string") {
    return prompt.prompt;
  }

  // If it has an "image_generation" field, extract the description
  if (prompt.image_generation) {
    const imgGen = prompt.image_generation;
    let description = "";

    if (imgGen.subject) {
      if (imgGen.subject.pose?.description) {
        description += imgGen.subject.pose.description + ". ";
      }
      if (imgGen.subject.expression) {
        description += `Expression: ${imgGen.subject.expression}. `;
      }
      if (imgGen.subject.hairstyle) {
        description += `Hair: ${imgGen.subject.hairstyle}. `;
      }
      if (imgGen.subject.clothing) {
        const clothing = imgGen.subject.clothing;
        if (clothing.top) description += `Wearing ${clothing.top}. `;
        if (clothing.bottom) description += `${clothing.bottom}. `;
        if (clothing.accessories) {
          description += `Accessories: ${clothing.accessories.join(", ")}. `;
        }
      }
    }

    if (imgGen.environment) {
      if (imgGen.environment.setting) {
        description += `Setting: ${imgGen.environment.setting}. `;
      }
      if (imgGen.environment.lighting) {
        description += `Lighting: ${imgGen.environment.lighting.type || imgGen.environment.lighting.tone}. `;
      }
    }

    if (imgGen.aesthetic) {
      description += `Style: ${imgGen.aesthetic.style || imgGen.aesthetic.mood}. `;
    }

    return description.trim() || JSON.stringify(prompt);
  }

  // For other prompt structures, try to extract key information
  if (prompt.subject) {
    let description = "";
    if (prompt.subject.pose) {
      description += `Pose: ${typeof prompt.subject.pose === "string" ? prompt.subject.pose : prompt.subject.pose.description || JSON.stringify(prompt.subject.pose)}. `;
    }
    if (prompt.subject.expression) {
      description += `Expression: ${prompt.subject.expression}. `;
    }
    if (prompt.subject.hair) {
      const hair = prompt.subject.hair;
      description += `Hair: ${hair.color || ""} ${hair.style || ""}. `.trim() + ". ";
    }
    if (prompt.subject.clothing) {
      description += `Clothing: ${JSON.stringify(prompt.subject.clothing)}. `;
    }
    if (prompt.environment) {
      description += `Environment: ${prompt.environment.setting || prompt.environment.location_type || JSON.stringify(prompt.environment)}. `;
    }
    return description.trim() || JSON.stringify(prompt);
  }

  // Fallback: stringify the whole prompt
  return JSON.stringify(prompt);
}

export const generateAvatarTask = task({
  id: "generate-avatar",
  maxDuration: 600, // 10 minutes
  run: async (payload: { generationId: string }) => {
    logger.log("Starting avatar generation", { generationId: payload.generationId });

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

      // Find or create avatar linked to this generation
      let [avatar] = await db
        .select()
        .from(avatars)
        .where(eq(avatars.generationId, payload.generationId))
        .limit(1);

      if (!avatar) {
        // Create avatar if it doesn't exist
        [avatar] = await db
          .insert(avatars)
          .values({
            prompt: generation.prompt,
            userId: generation.userId,
            generationId: generation.id,
            imageUrl: null,
          })
          .returning();
      }

      if (!avatar) {
        throw new Error("Failed to create or find avatar");
      }

      if (avatar.imageUrl) {
        logger.log("Avatar already has an image URL", { avatarId: avatar.id });
        // Update generation status to completed
        await db
          .update(generations)
          .set({
            status: "completed",
            updatedAt: new Date(),
          })
          .where(eq(generations.id, payload.generationId));
        return { success: true, imageUrl: avatar.imageUrl };
      }

      // Convert prompt to text
      const promptText = promptToText(generation.prompt);
      logger.log("Converted prompt to text", { promptLength: promptText.length });

      // Generate image
      logger.log("Generating image...");
      const images = await generateImage(promptText, {
        numberOfImages: 1,
        aspectRatio: "9:16", // Vertical aspect ratio
        imageSize: "1K",
        outputMimeType: "image/jpeg",
      });

      if (!images || images.length === 0) {
        throw new Error("No images were generated");
      }

      const generatedImage = images[0];
      logger.log("Image generated successfully");

      // Upload to S3
      const filename = `avatars/${avatar.id}.jpg`;
      logger.log("Uploading to S3...", { filename });
      const imageUrl = await uploadImage(
        generatedImage.imageBytes,
        filename,
        "image/jpeg"
      );

      logger.log("Image uploaded to S3", { imageUrl });

      // Update avatar record with image URL
      await db
        .update(avatars)
        .set({
          imageUrl,
          updatedAt: new Date(),
        })
        .where(eq(avatars.id, avatar.id));

      // Update generation status to completed
      await db
        .update(generations)
        .set({
          status: "completed",
          updatedAt: new Date(),
        })
        .where(eq(generations.id, payload.generationId));

      logger.log("Generation completed", { generationId: payload.generationId, avatarId: avatar.id, imageUrl });

      return {
        success: true,
        imageUrl,
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

      logger.error("Avatar generation failed", {
        generationId: payload.generationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});

export const remixAvatarTask = task({
  id: "remix-avatar",
  maxDuration: 600, // 10 minutes
  run: async (payload: {
    generationId: string;
    sourceImageUrl: string;
    instructions: string;
    productImageUrls?: string[];
    remixOptions?: RemixOptions;
  }) => {
    logger.log("Starting avatar remix", {
      generationId: payload.generationId,
      instructions: payload.instructions,
      productImageCount: payload.productImageUrls?.length || 0,
      remixOptions: payload.remixOptions,
    });

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

      // Find avatar linked to this generation
      const [avatar] = await db
        .select()
        .from(avatars)
        .where(eq(avatars.generationId, payload.generationId))
        .limit(1);

      if (!avatar) {
        throw new Error("Avatar not found for this generation");
      }

      if (avatar.imageUrl) {
        logger.log("Avatar already has an image URL", { avatarId: avatar.id });
        // Update generation status to completed
        await db
          .update(generations)
          .set({
            status: "completed",
            updatedAt: new Date(),
          })
          .where(eq(generations.id, payload.generationId));
        return { success: true, imageUrl: avatar.imageUrl };
      }

      // Generate image from reference using image-to-image generation
      logger.log("Generating remix image from reference...", {
        sourceImageUrl: payload.sourceImageUrl,
        instructions: payload.instructions,
        productImageCount: payload.productImageUrls?.length || 0
      });

      const images = await generateImageFromReference(
        payload.sourceImageUrl,
        payload.instructions,
        {
          numberOfImages: 1,
          aspectRatio: "9:16", // Vertical aspect ratio
          imageSize: "1K",
          outputMimeType: "image/jpeg",
        },
        payload.productImageUrls
      );

      if (!images || images.length === 0) {
        throw new Error("No images were generated");
      }

      const generatedImage = images[0];
      logger.log("Remix image generated successfully");

      // Upload to S3
      const filename = `avatars/${avatar.id}.jpg`;
      logger.log("Uploading to S3...", { filename });
      const imageUrl = await uploadImage(
        generatedImage.imageBytes,
        filename,
        "image/jpeg"
      );

      logger.log("Image uploaded to S3", { imageUrl });

      // Update avatar record with image URL
      await db
        .update(avatars)
        .set({
          imageUrl,
          updatedAt: new Date(),
        })
        .where(eq(avatars.id, avatar.id));

      // Update generation status to completed
      await db
        .update(generations)
        .set({
          status: "completed",
          updatedAt: new Date(),
        })
        .where(eq(generations.id, payload.generationId));

      logger.log("Remix completed", {
        generationId: payload.generationId,
        avatarId: avatar.id,
        imageUrl
      });

      return {
        success: true,
        imageUrl,
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

      logger.error("Avatar remix failed", {
        generationId: payload.generationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});

