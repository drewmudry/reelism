"use server";

import { db } from "@/index";
import { videoJobs, products, avatars, demos, compositeImages, indexedClips } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, inArray } from "drizzle-orm";
import { callDirector } from "@/lib/video-generation/director";
import { validatePlan } from "@/lib/video-generation/validation";
import { generateCompositeImage } from "@/lib/video-generation/composite";
import { generateVeoClip } from "@/lib/video-generation/veo";
import { tasks } from "@trigger.dev/sdk/v3";
import type { VideoGenerationPlan, DirectorInput } from "@/types/video-generation";
import { generateCompositesTask } from "@/trigger/generate-composites";
import { generateVeoClipsTask } from "@/trigger/generate-veo-clips";

/**
 * Create a video job and get the director plan, but don't generate assets yet
 */
export async function createVideoJobWithPlan(input: {
  productId: string;
  avatarId: string;
  demoIds: string[];
  tone: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // Validate product exists and belongs to user
  const product = await db.query.products.findFirst({
    where: eq(products.id, input.productId),
  });
  if (!product || product.userId !== session.user.id) {
    throw new Error("Product not found");
  }

  // Validate avatar exists
  const avatar = await db.query.avatars.findFirst({
    where: eq(avatars.id, input.avatarId),
  });
  if (!avatar) {
    throw new Error("Avatar not found");
  }

  // Validate demos exist (if any)
  const jobDemos = input.demoIds.length > 0
    ? await db.query.demos.findMany({
        where: inArray(demos.id, input.demoIds),
      })
    : [];
  if (input.demoIds.length > 0 && jobDemos.length !== input.demoIds.length) {
    throw new Error("One or more demos not found");
  }

  // Get existing clips for this product
  const existingClips = await db.query.indexedClips.findMany({
    where: eq(indexedClips.productId, product.id),
    orderBy: (clips, { desc }) => [desc(clips.usageCount)],
    limit: 10,
  });

  // Create the job record
  const [job] = await db
    .insert(videoJobs)
    .values({
      userId: session.user.id,
      productId: input.productId,
      avatarId: input.avatarId,
      demoIds: input.demoIds,
      tone: input.tone,
      targetDuration: 24, // Placeholder - director will determine
      status: "planning",
    })
    .returning();

  if (!job) {
    throw new Error("Failed to create video job");
  }

  // Call director
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
      tone: input.tone,
      targetDuration: 24 as 16 | 20 | 24,
    },
  };

  const plan = await callDirector(directorInput);

  // Validate the plan
  const validation = validatePlan(plan, directorInput);
  if (!validation.valid) {
    throw new Error(`Director plan validation failed: ${validation.errors.join(", ")}`);
  }

  // Store the plan
  await db
    .update(videoJobs)
    .set({
      directorPlan: plan as unknown as Record<string, unknown>,
      targetDuration: plan.totalDuration,
      status: "planning_completed",
    })
    .where(eq(videoJobs.id, job.id));

  // Create composite image entries (but don't generate them yet)
  const compositeDbIds: string[] = [];
  if (plan.imageGeneration.length > 0) {
    for (const task of plan.imageGeneration) {
      const [composite] = await db
        .insert(compositeImages)
        .values({
          userId: job.userId,
          avatarId: avatar.id,
          productId: product.id,
          productImageIndices: task.productSources.map((ref) => parseInt(ref.split("_")[1]) - 1),
          prompt: task.prompt,
          description: task.description,
          imageUrl: "", // Will be filled when generated
        })
        .returning();
      
      compositeDbIds.push(composite.id);
    }
  }

  // Update job with composite IDs
  await db
    .update(videoJobs)
    .set({ compositeImageIds: compositeDbIds })
    .where(eq(videoJobs.id, job.id));

  return {
    jobId: job.id,
    plan,
    compositeIds: compositeDbIds,
  };
}

/**
 * Generate a specific composite image
 */
export async function generateCompositeImageForJob(params: {
  jobId: string;
  compositeId: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const job = await db.query.videoJobs.findFirst({
    where: eq(videoJobs.id, params.jobId),
    with: {
      product: true,
      avatar: true,
    },
  });

  if (!job || job.userId !== session.user.id) {
    throw new Error("Job not found");
  }

  if (!job.directorPlan) {
    throw new Error("Director plan not found");
  }

  const plan = job.directorPlan as unknown as VideoGenerationPlan;
  const compositeIndex = (job.compositeImageIds as string[]).indexOf(params.compositeId);
  
  if (compositeIndex === -1) {
    throw new Error("Composite image not found in job");
  }

  const task = plan.imageGeneration[compositeIndex];
  if (!task) {
    throw new Error("Composite task not found in plan");
  }

  // Get product image URLs
  const productImageUrls = task.productSources.map((ref) => {
    const index = parseInt(ref.split("_")[1]) - 1;
    return (job.product.images as string[])[index];
  });

  // Generate the composite image
  const imageUrl = await generateCompositeImage({
    avatarImageUrl: job.avatar.imageUrl!,
    productImageUrls,
    prompt: task.prompt,
  });

  // Update the composite image record
  await db
    .update(compositeImages)
    .set({ imageUrl })
    .where(eq(compositeImages.id, params.compositeId));

  // Track completion
  const completedIds = (job.completedCompositeIds as string[]) || [];
  if (!completedIds.includes(params.compositeId)) {
    await db
      .update(videoJobs)
      .set({ completedCompositeIds: [...completedIds, params.compositeId] })
      .where(eq(videoJobs.id, params.jobId));
  }

  return { imageUrl, compositeId: params.compositeId };
}

/**
 * Generate a specific Veo clip
 */
export async function generateVeoClipForJob(params: {
  jobId: string;
  veoCallId: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const job = await db.query.videoJobs.findFirst({
    where: eq(videoJobs.id, params.jobId),
    with: {
      product: true,
      avatar: true,
    },
  });

  if (!job || job.userId !== session.user.id) {
    throw new Error("Job not found");
  }

  if (!job.directorPlan) {
    throw new Error("Director plan not found");
  }

  const plan = job.directorPlan as unknown as VideoGenerationPlan;
  const veoCall = plan.veoCalls.find((v) => v.callId === params.veoCallId);
  
  if (!veoCall) {
    throw new Error("Veo call not found in plan");
  }

  // Get source image URL based on type
  let sourceImageUrl: string;
  if (veoCall.sourceImageType === "avatar") {
    sourceImageUrl = job.avatar.imageUrl!;
  } else if (veoCall.sourceImageType === "composite") {
    // Find the composite image by matching the compositeId from the plan
    const compositeTask = plan.imageGeneration.find(
      (ig) => ig.compositeId === veoCall.sourceImageRef
    );
    
    if (!compositeTask) {
      throw new Error("Composite image task not found in plan");
    }

    // Find the index of this composite in the plan
    const taskIndex = plan.imageGeneration.findIndex(
      (ig) => ig.compositeId === compositeTask.compositeId
    );
    
    if (taskIndex === -1 || taskIndex >= (job.compositeImageIds as string[]).length) {
      throw new Error("Composite image not created in database yet");
    }

    const compositeDbId = (job.compositeImageIds as string[])[taskIndex];
    const composite = await db.query.compositeImages.findFirst({
      where: eq(compositeImages.id, compositeDbId),
    });

    if (!composite) {
      throw new Error("Composite image not found in database");
    }

    if (!composite.imageUrl) {
      throw new Error("Composite image not generated yet - please generate it first");
    }

    sourceImageUrl = composite.imageUrl;
  } else if (veoCall.sourceImageType === "product") {
    const index = parseInt(veoCall.sourceImageRef.split("_")[1]) - 1;
    sourceImageUrl = (job.product.images as string[])[index];
  } else {
    throw new Error("Invalid source image type");
  }

  // Generate the Veo clip
  const { url, buffer } = await generateVeoClip({
    sourceImageUrl,
    prompt: veoCall.prompt,
  });

  // Update job with Veo clip URL
  const currentUrls = (job.veoClipUrls as string[]) || [];
  if (!currentUrls.includes(url)) {
    await db
      .update(videoJobs)
      .set({ veoClipUrls: [...currentUrls, url] })
      .where(eq(videoJobs.id, params.jobId));
  }

  // Track completion
  const completedIds = (job.completedVeoCallIds as string[]) || [];
  if (!completedIds.includes(params.veoCallId)) {
    await db
      .update(videoJobs)
      .set({ completedVeoCallIds: [...completedIds, params.veoCallId] })
      .where(eq(videoJobs.id, params.jobId));
  }

  return { url, veoCallId: params.veoCallId };
}

/**
 * Delete a composite image
 */
export async function deleteCompositeImage(params: {
  jobId: string;
  compositeId: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const job = await db.query.videoJobs.findFirst({
    where: eq(videoJobs.id, params.jobId),
  });

  if (!job || job.userId !== session.user.id) {
    throw new Error("Job not found");
  }

  // Verify composite belongs to this job
  if (!(job.compositeImageIds as string[]).includes(params.compositeId)) {
    throw new Error("Composite image not found in job");
  }

  // Delete the composite image
  await db
    .delete(compositeImages)
    .where(eq(compositeImages.id, params.compositeId));

  // Remove from job's compositeImageIds
  const updatedIds = (job.compositeImageIds as string[]).filter(
    (id) => id !== params.compositeId
  );
  
  // Remove from completed list
  const completedIds = ((job.completedCompositeIds as string[]) || []).filter(
    (id) => id !== params.compositeId
  );
  
  await db
    .update(videoJobs)
    .set({ 
      compositeImageIds: updatedIds,
      completedCompositeIds: completedIds,
    })
    .where(eq(videoJobs.id, params.jobId));

  return { success: true };
}

/**
 * Delete a Veo clip (remove URL from job)
 */
export async function deleteVeoClip(params: {
  jobId: string;
  veoClipUrl: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const job = await db.query.videoJobs.findFirst({
    where: eq(videoJobs.id, params.jobId),
  });

  if (!job || job.userId !== session.user.id) {
    throw new Error("Job not found");
  }

  // Remove URL from job's veoClipUrls
  const currentUrls = (job.veoClipUrls as string[]) || [];
  const updatedUrls = currentUrls.filter((url) => url !== params.veoClipUrl);
  
  // Find and remove the corresponding veoCallId from completed list
  // We need to match by URL since we don't have the callId here
  // This is a limitation - we'll need to track URL to callId mapping better
  // For now, we'll just remove the URL
  const plan = job.directorPlan as unknown as VideoGenerationPlan;
  let veoCallIdToRemove: string | null = null;
  
  if (plan?.veoCalls) {
    // Try to find which callId this URL belongs to
    // This is approximate - in a real system you'd track this better
    const urlIndex = currentUrls.indexOf(params.veoClipUrl);
    if (urlIndex >= 0 && urlIndex < plan.veoCalls.length) {
      veoCallIdToRemove = plan.veoCalls[urlIndex].callId;
    }
  }
  
  const completedIds = ((job.completedVeoCallIds as string[]) || []).filter(
    (id) => id !== veoCallIdToRemove
  );
  
  await db
    .update(videoJobs)
    .set({ 
      veoClipUrls: updatedUrls,
      completedVeoCallIds: completedIds,
    })
    .where(eq(videoJobs.id, params.jobId));

  return { success: true };
}

/**
 * Get all composite images for a job
 */
export async function getCompositeImagesForJob(jobId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const job = await db.query.videoJobs.findFirst({
    where: eq(videoJobs.id, jobId),
  });

  if (!job || job.userId !== session.user.id) {
    throw new Error("Job not found");
  }

  const compositeIds = (job.compositeImageIds as string[]) || [];
  if (compositeIds.length === 0) {
    return [];
  }

  const composites = await db.query.compositeImages.findMany({
    where: inArray(compositeImages.id, compositeIds),
  });

  return composites;
}

/**
 * Get pipeline progress for a job
 */
export async function getJobProgress(jobId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const job = await db.query.videoJobs.findFirst({
    where: eq(videoJobs.id, jobId),
  });

  if (!job || job.userId !== session.user.id) {
    throw new Error("Job not found");
  }

  if (!job.directorPlan) {
    return {
      planningCompleted: false,
      compositesCompleted: 0,
      compositesTotal: 0,
      veoCallsCompleted: 0,
      veoCallsTotal: 0,
      canGenerateVeo: false,
      canAssemble: false,
    };
  }

  const plan = job.directorPlan as unknown as VideoGenerationPlan;
  const completedComposites = (job.completedCompositeIds as string[]) || [];
  const completedVeoCalls = (job.completedVeoCallIds as string[]) || [];
  
  const compositesTotal = plan.imageGeneration.length;
  const compositesCompleted = completedComposites.length;
  
  const veoCallsTotal = plan.veoCalls.length;
  const veoCallsCompleted = completedVeoCalls.length;

  // Check if all required composites are done for veo generation
  const requiredComposites = new Set<string>();
  for (const veoCall of plan.veoCalls) {
    if (veoCall.sourceImageType === "composite") {
      requiredComposites.add(veoCall.sourceImageRef);
    }
  }
  
  const requiredCompositeIds = plan.imageGeneration
    .filter((ig) => requiredComposites.has(ig.compositeId))
    .map((ig, idx) => (job.compositeImageIds as string[])[idx])
    .filter(Boolean);
  
  const allRequiredCompositesDone = requiredCompositeIds.every((id) =>
    completedComposites.includes(id)
  );

  // Can assemble if all veo calls are done
  const canAssemble = veoCallsCompleted === veoCallsTotal && veoCallsTotal > 0;

  return {
    planningCompleted: true,
    compositesCompleted,
    compositesTotal,
    veoCallsCompleted,
    veoCallsTotal,
    canGenerateVeo: allRequiredCompositesDone || requiredComposites.size === 0,
    canAssemble,
    requiredComposites: Array.from(requiredComposites),
  };
}

/**
 * Trigger sequential generation: composites first, then Veo clips
 * The Veo task will automatically wait for composites to complete if needed
 */
export async function triggerSequentialGeneration(jobId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const job = await db.query.videoJobs.findFirst({
    where: eq(videoJobs.id, jobId),
  });

  if (!job || job.userId !== session.user.id) {
    throw new Error("Job not found");
  }

  if (!job.directorPlan) {
    throw new Error("Director plan not found");
  }

  // Trigger composite generation first
  const compositeHandle = await generateCompositesTask.trigger({ jobId });

  // Trigger Veo clip generation - it will wait for composites if needed
  const veoHandle = await generateVeoClipsTask.trigger({ jobId });

  return {
    compositeTaskId: compositeHandle.id,
    veoTaskId: veoHandle.id,
  };
}

/**
 * Trigger only composite generation
 */
export async function triggerCompositeGeneration(jobId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const job = await db.query.videoJobs.findFirst({
    where: eq(videoJobs.id, jobId),
  });

  if (!job || job.userId !== session.user.id) {
    throw new Error("Job not found");
  }

  const handle = await generateCompositesTask.trigger({ jobId });

  return { taskId: handle.id };
}

/**
 * Trigger only Veo clip generation (requires composites to be done first)
 */
export async function triggerVeoGeneration(jobId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const job = await db.query.videoJobs.findFirst({
    where: eq(videoJobs.id, jobId),
  });

  if (!job || job.userId !== session.user.id) {
    throw new Error("Job not found");
  }

  const handle = await generateVeoClipsTask.trigger({ jobId });

  return { taskId: handle.id };
}

