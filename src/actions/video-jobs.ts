"use server";

import { db } from "@/index";
import { videoJobs, products, avatars, demos } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, inArray } from "drizzle-orm";
import { generateVideoTask } from "@/trigger/generate-video";

export async function createVideoJob(input: {
  productId: string;
  avatarId: string;
  demoIds: string[];
  tone: string;
  // targetDuration will be determined by the director (16-24 seconds)
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
  if (input.demoIds.length > 0) {
    const foundDemos = await db.query.demos.findMany({
      where: inArray(demos.id, input.demoIds),
    });
    if (foundDemos.length !== input.demoIds.length) {
      throw new Error("One or more demos not found");
    }
  }

  // Create the job record
  // Duration will be determined by the director (16-24 seconds to maximize Veo clip utilization)
  // We'll use 24 as a placeholder, but the director will choose the optimal duration
  const [job] = await db
    .insert(videoJobs)
    .values({
      userId: session.user.id,
      productId: input.productId,
      avatarId: input.avatarId,
      demoIds: input.demoIds,
      tone: input.tone,
      targetDuration: 24, // Placeholder - director will determine optimal duration (16-24s)
      status: "pending",
    })
    .returning();

  if (!job) {
    throw new Error("Failed to create video job");
  }

  // Trigger the workflow
  const handle = await generateVideoTask.trigger({
    jobId: job.id,
  });

  // Update job with trigger ID
  await db
    .update(videoJobs)
    .set({ triggerJobId: handle.id })
    .where(eq(videoJobs.id, job.id));

  return { jobId: job.id, triggerId: handle.id };
}

export async function getVideoJob(jobId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const job = await db.query.videoJobs.findFirst({
    where: eq(videoJobs.id, jobId),
    with: {
      product: true,
      avatar: true,
    },
  });

  if (!job || job.userId !== session.user.id) {
    throw new Error("Job not found");
  }

  return job;
}

export async function getUserVideoJobs() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const jobs = await db.query.videoJobs.findMany({
    where: eq(videoJobs.userId, session.user.id),
    orderBy: (videoJobs, { desc }) => [desc(videoJobs.createdAt)],
    with: {
      product: true,
      avatar: true,
    },
  });

  return jobs;
}

