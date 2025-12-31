"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/index";
import { animations, generations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateAnimationTask } from "@/trigger/generate-animation";

export async function generateAnimationFromAvatar(
  avatarId: string,
  prompt: string,
  productImageUrls?: string[]
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  try {
    // Verify avatar exists and belongs to user (or is curated)
    const { avatars } = await import("@/db/schema");
    const [avatar] = await db
      .select()
      .from(avatars)
      .where(eq(avatars.id, avatarId))
      .limit(1);

    if (!avatar) {
      throw new Error("Avatar not found");
    }

    if (!avatar.imageUrl) {
      throw new Error("Avatar image not available");
    }

    // Create generation record
    const [generation] = await db
      .insert(generations)
      .values({
        userId: session.user.id,
        prompt: { prompt, productImageUrls },
        status: "pending",
        triggerJobId: null,
      })
      .returning();

    if (!generation) {
      throw new Error("Failed to create generation record");
    }

    // Create animation record linked to generation and avatar
    const [animation] = await db
      .insert(animations)
      .values({
        prompt,
        avatarId: avatar.id,
        userId: session.user.id,
        generationId: generation.id,
        videoUrl: null,
      })
      .returning();

    if (!animation) {
      throw new Error("Failed to create animation record");
    }

    // Trigger the generation task
    const handle = await generateAnimationTask.trigger({
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
      animationId: animation.id,
      jobId: handle.id,
    };
  } catch (error) {
    console.error("Failed to generate animation:", error);
    throw error;
  }
}

export async function getAnimationStatus(animationId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  const [animation] = await db
    .select()
    .from(animations)
    .where(eq(animations.id, animationId))
    .limit(1);

  if (!animation) {
    throw new Error("Animation not found");
  }

  // Check if animation belongs to user
  if (animation.userId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  // Get generation status if generationId exists
  let generationStatus = null;
  let triggerJobId = null;
  if (animation.generationId) {
    const [generation] = await db
      .select()
      .from(generations)
      .where(eq(generations.id, animation.generationId))
      .limit(1);

    if (generation) {
      generationStatus = generation.status;
      triggerJobId = generation.triggerJobId;
    }
  }

  return {
    id: animation.id,
    videoUrl: animation.videoUrl,
    generationId: animation.generationId,
    generationStatus,
    triggerJobId,
    isComplete: !!animation.videoUrl,
  };
}
