"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/index";
import { animations, generations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateAnimationFromVideoTask } from "@/trigger/generate-animation-from-video";

export async function generateAnimationFromVideo(
  animationId: string,
  productImageUrls: string[],
  prompt: string
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  try {
    // Verify animation exists and belongs to user
    const [existingAnimation] = await db
      .select()
      .from(animations)
      .where(eq(animations.id, animationId))
      .limit(1);

    if (!existingAnimation) {
      throw new Error("Animation not found");
    }

    if (existingAnimation.userId !== session.user.id) {
      throw new Error("Unauthorized");
    }

    if (!existingAnimation.videoUrl) {
      throw new Error("Animation video not available");
    }

    // Get the avatar image for the animation
    const { avatars } = await import("@/db/schema");
    const [avatar] = await db
      .select()
      .from(avatars)
      .where(eq(avatars.id, existingAnimation.avatarId))
      .limit(1);

    if (!avatar || !avatar.imageUrl) {
      throw new Error("Avatar image not found");
    }

    // Limit to max 2 product images (avatar takes 1 slot, max 3 total)
    const limitedProductUrls = productImageUrls.slice(0, 2);

    // Create generation record
    const [generation] = await db
      .insert(generations)
      .values({
        userId: session.user.id,
        prompt: { 
          prompt: prompt, // Use custom prompt provided by user
          productImageUrls: limitedProductUrls,
          sourceAnimationId: animationId,
        },
        status: "pending",
        triggerJobId: null,
      })
      .returning();

    if (!generation) {
      throw new Error("Failed to create generation record");
    }

    // Create new animation record linked to generation and avatar
    const [newAnimation] = await db
      .insert(animations)
      .values({
        prompt: prompt, // Use custom prompt
        avatarId: existingAnimation.avatarId,
        userId: session.user.id,
        generationId: generation.id,
        videoUrl: null,
      })
      .returning();

    if (!newAnimation) {
      throw new Error("Failed to create animation record");
    }

    // Trigger the generation task
    const handle = await generateAnimationFromVideoTask.trigger({
      generationId: generation.id,
      avatarImageUrl: avatar.imageUrl,
    });

    // Update generation with job ID
    await db
      .update(generations)
      .set({
        triggerJobId: handle.id,
      })
      .where(eq(generations.id, generation.id));

    // Invalidate the animations page cache
    revalidatePath("/app/animations");

    return {
      success: true,
      generationId: generation.id,
      animationId: newAnimation.id,
      jobId: handle.id,
    };
  } catch (error) {
    console.error("Failed to generate animation from video:", error);
    throw error;
  }
}

