"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/index";
import { avatars, generations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateAvatarTask } from "@/trigger/generate-avatar";


export async function generateAvatarFromPrompt(promptInput: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  try {
    // Try to parse as JSON, otherwise treat as plain string
    let prompt: any;
    try {
      prompt = JSON.parse(promptInput);
    } catch {
      // If not valid JSON, wrap it in an object
      prompt = { prompt: promptInput };
    }

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
    console.error("Failed to generate avatar from prompt:", error);
    throw error;
  }
}

export async function remixAvatar(avatarId: string, instructions: string, productImageUrls?: string[]) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  if (!instructions.trim()) {
    throw new Error("Instructions cannot be empty");
  }

  try {
    // Fetch the source avatar
    const [sourceAvatar] = await db
      .select()
      .from(avatars)
      .where(eq(avatars.id, avatarId))
      .limit(1);

    if (!sourceAvatar) {
      throw new Error("Avatar not found");
    }

    // Check if source avatar has an image
    // Note: We allow remixing any avatar (including curated ones with userId = null)
    // because the remix creates a new avatar owned by the current user
    if (!sourceAvatar.imageUrl) {
      throw new Error("Source avatar must have an image to remix");
    }

    // Create generation record with instructions
    const [generation] = await db
      .insert(generations)
      .values({
        userId: session.user.id,
        prompt: { instructions, remixFrom: avatarId, productImageUrls },
        status: "pending",
        triggerJobId: null,
      })
      .returning();

    if (!generation) {
      throw new Error("Failed to create generation record");
    }

    // Create avatar record linked to generation and source avatar
    const [remixedAvatar] = await db
      .insert(avatars)
      .values({
        prompt: sourceAvatar.prompt, // Keep original prompt structure
        userId: session.user.id,
        generationId: generation.id,
        remixedFromId: avatarId,
        imageUrl: null,
      })
      .returning();

    if (!remixedAvatar) {
      throw new Error("Failed to create remixed avatar record");
    }

    // Trigger the remix generation task
    const { remixAvatarTask } = await import("@/trigger/generate-avatar");
    const handle = await remixAvatarTask.trigger({
      generationId: generation.id,
      sourceImageUrl: sourceAvatar.imageUrl,
      instructions: instructions.trim(),
      productImageUrls,
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
      avatarId: remixedAvatar.id,
      jobId: handle.id,
    };
  } catch (error) {
    console.error("Failed to remix avatar:", error);
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

