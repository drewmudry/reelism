"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/index";
import { avatars, generations } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateAvatarTask } from "@/trigger/generate-avatar";

export async function getAvatars() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  try {
    const userAvatars = await db
      .select()
      .from(avatars)
      .where(eq(avatars.userId, session.user.id))
      .orderBy(desc(avatars.createdAt));

    return userAvatars.map((avatar) => ({
      id: avatar.id,
      imageUrl: avatar.imageUrl,
      prompt: avatar.prompt,
      createdAt: avatar.createdAt,
      updatedAt: avatar.updatedAt,
    }));
  } catch (error) {
    console.error("Failed to fetch avatars:", error);
    throw error;
  }
}

export async function getAvatarById(avatarId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  try {
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

    return {
      id: avatar.id,
      imageUrl: avatar.imageUrl,
      prompt: avatar.prompt,
      createdAt: avatar.createdAt,
      updatedAt: avatar.updatedAt,
    };
  } catch (error) {
    console.error("Failed to fetch avatar:", error);
    throw error;
  }
}

export async function deleteAvatar(avatarId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  try {
    // First verify the avatar belongs to the user
    const [avatar] = await db
      .select()
      .from(avatars)
      .where(eq(avatars.id, avatarId))
      .limit(1);

    if (!avatar) {
      throw new Error("Avatar not found");
    }

    if (avatar.userId !== session.user.id) {
      throw new Error("Unauthorized");
    }

    // Delete the avatar
    await db.delete(avatars).where(eq(avatars.id, avatarId));

    return { success: true };
  } catch (error) {
    console.error("Failed to delete avatar:", error);
    throw error;
  }
}

export async function updateAvatarPrompt(avatarId: string, prompt: any) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  try {
    // First verify the avatar belongs to the user
    const [avatar] = await db
      .select()
      .from(avatars)
      .where(eq(avatars.id, avatarId))
      .limit(1);

    if (!avatar) {
      throw new Error("Avatar not found");
    }

    if (avatar.userId !== session.user.id) {
      throw new Error("Unauthorized");
    }

    // Update the prompt
    await db
      .update(avatars)
      .set({
        prompt,
        updatedAt: new Date(),
      })
      .where(eq(avatars.id, avatarId));

    return { success: true };
  } catch (error) {
    console.error("Failed to update avatar prompt:", error);
    throw error;
  }
}

export async function regenerateAvatar(avatarId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  try {
    // Get the avatar
    const [avatar] = await db
      .select()
      .from(avatars)
      .where(eq(avatars.id, avatarId))
      .limit(1);

    if (!avatar) {
      throw new Error("Avatar not found");
    }

    if (avatar.userId !== session.user.id) {
      throw new Error("Unauthorized");
    }

    // Create a new generation with the same prompt
    const [generation] = await db
      .insert(generations)
      .values({
        userId: session.user.id,
        prompt: avatar.prompt,
        status: "pending",
        triggerJobId: null,
      })
      .returning();

    if (!generation) {
      throw new Error("Failed to create generation record");
    }

    // Create a new avatar linked to the generation
    const [newAvatar] = await db
      .insert(avatars)
      .values({
        prompt: avatar.prompt,
        userId: session.user.id,
        generationId: generation.id,
        imageUrl: null,
      })
      .returning();

    if (!newAvatar) {
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
      avatarId: newAvatar.id,
      generationId: generation.id,
      jobId: handle.id,
    };
  } catch (error) {
    console.error("Failed to regenerate avatar:", error);
    throw error;
  }
}

