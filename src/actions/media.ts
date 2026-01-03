"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getPresignedDownloadUrl } from "@/lib/storage";

/**
 * Get presigned download URL for media files
 * Requires authentication
 */
export async function getDownloadUrl(publicUrl: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");

  return await getPresignedDownloadUrl(publicUrl);
}

