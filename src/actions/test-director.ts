"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/index";
import { products, avatars, demos, indexedClips } from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { callDirector } from "@/lib/video-generation/director";
import { validatePlan } from "@/lib/video-generation/validation";
import type { DirectorInput } from "@/types/video-generation";

export async function testDirector(input: {
  productId: string;
  avatarId: string;
  demoIds?: string[];
  tone?: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // Load product
  const product = await db.query.products.findFirst({
    where: eq(products.id, input.productId),
  });
  if (!product || product.userId !== session.user.id) {
    throw new Error("Product not found");
  }

  // Load avatar
  const avatar = await db.query.avatars.findFirst({
    where: eq(avatars.id, input.avatarId),
  });
  if (!avatar) {
    throw new Error("Avatar not found");
  }

  // Load demos if provided
  const jobDemos =
    (input.demoIds && input.demoIds.length > 0)
      ? await db.query.demos.findMany({
          where: inArray(demos.id, input.demoIds),
        })
      : [];

  // Fetch existing indexed clips for this product
  const existingClips = await db.query.indexedClips.findMany({
    where: eq(indexedClips.productId, input.productId),
    orderBy: [desc(indexedClips.usageCount)],
    limit: 10,
  });

  // Build director input
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
      tone: input.tone || "energetic and authentic",
      targetDuration: 24 as 16 | 20 | 24, // Not used - director chooses
    },
  };

  // Call director
  const plan = await callDirector(directorInput);

  // Validate the plan
  const validation = validatePlan(plan, directorInput);

  return {
    plan,
    validation,
    directorInput,
  };
}

