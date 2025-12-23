"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/index";
import { uploads } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getPresignedUploadUrl, getPresignedDownloadUrl } from "@/lib/storage";

// 1. Get Presigned URL for direct S3 upload
export async function getUploadPresignedUrl(
  filename: string,
  contentType: string,
  type: "demo" | "video" | "image"
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");

  // Organize S3 keys by user and type
  const ext = filename.split('.').pop();
  const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
  const s3Key = `uploads/${session.user.id}/${type}s/${uniqueName}`;

  return await getPresignedUploadUrl(s3Key, contentType);
}

// 2. Save Upload Record to DB
export async function createUploadRecord(input: {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  type: "demo" | "video" | "image";
  title?: string;
  description?: string;
  demo?: boolean;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");

  const [record] = await db.insert(uploads).values({
    userId: session.user.id,
    demo: input.demo || false,
    ...input
  }).returning();

  return record;
}

// 3. Fetch User Uploads
export async function getUserUploads(type?: "demo" | "video" | "image", demo?: boolean) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");

  const conditions = [eq(uploads.userId, session.user.id)];
  if (type) conditions.push(eq(uploads.type, type));
  if (demo !== undefined) conditions.push(eq(uploads.demo, demo));

  return await db.select()
    .from(uploads)
    .where(and(...conditions))
    .orderBy(desc(uploads.createdAt));
}

// 4. Update Upload
export async function updateUpload(uploadId: string, title: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");

  // Verify ownership
  const [existing] = await db
    .select()
    .from(uploads)
    .where(and(
      eq(uploads.id, uploadId),
      eq(uploads.userId, session.user.id)
    ))
    .limit(1);

  if (!existing) {
    throw new Error("Upload not found");
  }

  const [updated] = await db
    .update(uploads)
    .set({
      title: title.trim() || null,
      updatedAt: new Date(),
    })
    .where(and(
      eq(uploads.id, uploadId),
      eq(uploads.userId, session.user.id)
    ))
    .returning();

  if (!updated) {
    throw new Error("Failed to update upload");
  }

  return updated;
}

// 5. Delete Upload
export async function deleteUpload(uploadId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");

  // In a real app, you should also delete the file from S3 here
  await db.delete(uploads)
    .where(and(
      eq(uploads.id, uploadId),
      eq(uploads.userId, session.user.id)
    ));

  return { success: true };
}

// 6. Get Presigned Download URL
export async function getDownloadUrl(publicUrl: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");

  return await getPresignedDownloadUrl(publicUrl);
}
