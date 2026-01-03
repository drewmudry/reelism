"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/index";
import { demos } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getPresignedUploadUrl } from "@/lib/storage";

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
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");

  const [record] = await db.insert(demos).values({
    userId: session.user.id,
    ...input
  }).returning();

  return record;
}

// 3. Fetch User Demos
export async function getUserDemos() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");

  return await db.select()
    .from(demos)
    .where(eq(demos.userId, session.user.id))
    .orderBy(desc(demos.createdAt));
}

// 4. Update Demo
export async function updateDemo(demoId: string, title: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");

  // Verify ownership
  const [existing] = await db
    .select()
    .from(demos)
    .where(eq(demos.id, demoId))
    .limit(1);

  if (!existing || existing.userId !== session.user.id) {
    throw new Error("Demo not found");
  }

  const [updated] = await db
    .update(demos)
    .set({
      title: title.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(demos.id, demoId))
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

