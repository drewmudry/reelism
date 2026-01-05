"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/index";
import { demos } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getPresignedUploadUrl } from "@/lib/storage";
import { analyzeDemoVideoTask } from "@/trigger/analyze-demo-video";

// 1. Get Presigned URL for direct S3 upload
export async function getDemoUploadPresignedUrl(
  filename: string,
  contentType: string
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");

  // Organize S3 keys by user
  const ext = filename.split('.').pop();
  const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
  const s3Key = `demos/${session.user.id}/${uniqueName}`;

  return await getPresignedUploadUrl(s3Key, contentType);
}

// 2. Save Demo Record to DB
export async function createDemoRecord(input: {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  title?: string;
  description?: string;
  productId?: string;
  width?: number;
  height?: number;
  talkingHeadRegions?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    startTime?: number;
    endTime?: number;
  }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");

  // Create the demo record first
  const [record] = await db.insert(demos).values({
    userId: session.user.id,
    ...input,
    talkingHeadRegions: input.talkingHeadRegions || [],
  }).returning();

  if (!record) {
    throw new Error("Failed to create demo record");
  }

  // Trigger background task to analyze video if it's a video file
  if (input.mimeType.startsWith('video/')) {
    try {
      await analyzeDemoVideoTask.trigger({
        demoId: record.id,
        videoUrl: input.url,
        mimeType: input.mimeType,
      });
    } catch (error) {
      console.error('Failed to trigger video analysis task:', error);
      // Don't fail the demo creation if task trigger fails, just log the error
    }
  }

  return record;
}

// 3. Fetch User Demos
export async function getUserDemos(productId?: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");

  if (productId) {
    return await db.select()
      .from(demos)
      .where(and(
        eq(demos.userId, session.user.id),
        eq(demos.productId, productId)
      ))
      .orderBy(desc(demos.createdAt));
  }

  return await db.select()
    .from(demos)
    .where(eq(demos.userId, session.user.id))
    .orderBy(desc(demos.createdAt));
}

// 4. Update Demo
export async function updateDemo(input: {
  demoId: string;
  title?: string;
  productId?: string | null;
  talkingHeadRegions?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    startTime?: number;
    endTime?: number;
  }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");

  // Verify ownership
  const [existing] = await db
    .select()
    .from(demos)
    .where(eq(demos.id, input.demoId))
    .limit(1);

  if (!existing || existing.userId !== session.user.id) {
    throw new Error("Demo not found");
  }

  const updateData: Partial<typeof demos.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.title !== undefined) {
    updateData.title = input.title.trim() || null;
  }
  if (input.productId !== undefined) {
    updateData.productId = input.productId || null;
  }
  if (input.talkingHeadRegions !== undefined) {
    updateData.talkingHeadRegions = input.talkingHeadRegions;
  }

  const [updated] = await db
    .update(demos)
    .set(updateData)
    .where(eq(demos.id, input.demoId))
    .returning();

  if (!updated) {
    throw new Error("Failed to update demo");
  }

  return updated;
}

// 5. Delete Demo
export async function deleteDemo(demoId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");

  // In a real app, you should also delete the file from S3 here
  await db.delete(demos)
    .where(eq(demos.id, demoId));

  return { success: true };
}

