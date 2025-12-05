"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/index";
import { avatars, generations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateAvatarTask } from "@/trigger/generate-avatar";
import { avatarPrompts } from "../../avatarPrompts";

export async function startAvatarGeneration() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  try {
    // Get the first prompt as a proof of concept
    const prompt = avatarPrompts[0].prompt;

    // Create generation record
    const [generation] = await db
      .insert(generations)
      .values({
        userId: session.user.id,
        prompt,
        status: "pending",
        triggerJobId: null,
      })
      .returning();

    if (!generation) {
      throw new Error("Failed to create generation record");
    }

    // Create avatar record linked to generation
    const [avatar] = await db
      .insert(avatars)
      .values({
        prompt,
        userId: session.user.id,
        generationId: generation.id,
        imageUrl: null,
      })
      .returning();

    if (!avatar) {
      throw new Error("Failed to create avatar record");
    }

    // Trigger the generation task
    const handle = await generateAvatarTask.trigger({
      generationId: generation.id,
    });

    // Update generation with job ID
    await db
      .update(generations)
      .set({
        triggerJobId: handle.id,
      })
      .where(eq(generations.id, generation.id));

    return {
      success: true,
      generationId: generation.id,
      avatarId: avatar.id,
      jobId: handle.id,
    };
  } catch (error) {
    console.error("Failed to start avatar generation:", error);
    throw error;
  }
}

export async function generateAllAvatars() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  try {
    const results = [];

    // Process all prompts
    for (let i = 0; i < avatarPrompts.length; i++) {
      const prompt = avatarPrompts[i].prompt;

      try {
        // Create generation record
        const [generation] = await db
          .insert(generations)
          .values({
            userId: session.user.id,
            prompt,
            status: "pending",
            triggerJobId: null,
          })
          .returning();

        if (!generation) {
          console.error(`Failed to create generation for prompt ${i + 1}`);
          results.push({
            index: i + 1,
            success: false,
            error: "Failed to create generation record",
          });
          continue;
        }

        // Create avatar record linked to generation
        const [avatar] = await db
          .insert(avatars)
          .values({
            prompt,
            userId: session.user.id,
            generationId: generation.id,
            imageUrl: null,
          })
          .returning();

        if (!avatar) {
          console.error(`Failed to create avatar for prompt ${i + 1}`);
          results.push({
            index: i + 1,
            success: false,
            error: "Failed to create avatar record",
          });
          continue;
        }

        // Trigger the generation task
        const handle = await generateAvatarTask.trigger({
          generationId: generation.id,
        });

        // Update generation with job ID
        await db
          .update(generations)
          .set({
            triggerJobId: handle.id,
          })
          .where(eq(generations.id, generation.id));

        results.push({
          index: i + 1,
          success: true,
          generationId: generation.id,
          avatarId: avatar.id,
          jobId: handle.id,
        });
      } catch (error) {
        console.error(`Error processing prompt ${i + 1}:`, error);
        results.push({
          index: i + 1,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      success: true,
      total: avatarPrompts.length,
      successful,
      failed,
      results,
    };
  } catch (error) {
    console.error("Failed to generate all avatars:", error);
    throw error;
  }
}

export async function getAvatarStatus(avatarId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  const [avatar] = await db
    .select()
    .from(avatars)
    .where(eq(avatars.id, avatarId))
    .limit(1);

  if (!avatar) {
    throw new Error("Avatar not found");
  }

  // Check if avatar belongs to user
  if (avatar.userId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  // Get generation status if generationId exists
  let generationStatus = null;
  let triggerJobId = null;
  if (avatar.generationId) {
    const [generation] = await db
      .select()
      .from(generations)
      .where(eq(generations.id, avatar.generationId))
      .limit(1);
    
    if (generation) {
      generationStatus = generation.status;
      triggerJobId = generation.triggerJobId;
    }
  }

  return {
    id: avatar.id,
    imageUrl: avatar.imageUrl,
    generationId: avatar.generationId,
    generationStatus,
    triggerJobId,
    isComplete: !!avatar.imageUrl,
  };
}

