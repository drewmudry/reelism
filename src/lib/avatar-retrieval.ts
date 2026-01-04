/**
 * Avatar Image Retrieval Module
 *
 * Provides functionality to fetch and cache avatar images from S3
 * for use in the video generation pipeline with fallback mechanisms.
 */

import { S3Client, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";

// S3 Client configuration (reuse pattern from storage.ts)
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "auto",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

/**
 * In-memory cache for avatar image data
 * Key: avatarId or S3 key
 * Value: cached image data with metadata
 */
interface CacheEntry {
  data: Buffer;
  mimeType: string;
  fetchedAt: Date;
  expiresAt: Date;
  eTag?: string;
}

const imageCache = new Map<string, CacheEntry>();

// Default cache TTL: 15 minutes (matches WebFetch pattern)
const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000;

// Maximum cache size (number of entries)
const MAX_CACHE_ENTRIES = 100;

/**
 * Default fallback image as a 1x1 transparent PNG
 * Used when all retrieval methods fail
 */
const FALLBACK_PLACEHOLDER_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/**
 * Configuration options for avatar image retrieval
 */
export interface AvatarRetrievalOptions {
  /** Custom cache TTL in milliseconds (default: 15 minutes) */
  cacheTtlMs?: number;
  /** Whether to skip cache and fetch fresh (default: false) */
  skipCache?: boolean;
  /** Whether to generate presigned URL instead of fetching data (default: false) */
  usePresignedUrl?: boolean;
  /** Presigned URL expiration in seconds (default: 300 = 5 minutes) */
  presignedUrlExpiresIn?: number;
  /** Whether to normalize image format to JPEG (default: true) */
  normalizeFormat?: boolean;
  /** Target format for normalization (default: 'jpeg') */
  targetFormat?: "jpeg" | "png" | "webp";
  /** Quality for JPEG/WebP compression (default: 90) */
  quality?: number;
}

/**
 * Result from avatar image retrieval
 */
export interface AvatarImageResult {
  /** Whether retrieval was successful */
  success: boolean;
  /** Image data as Buffer (when usePresignedUrl is false) */
  data?: Buffer;
  /** Base64 encoded image data */
  base64?: string;
  /** Data URL for direct use in img src */
  dataUrl?: string;
  /** Presigned URL (when usePresignedUrl is true) */
  presignedUrl?: string;
  /** Original public URL of the avatar */
  publicUrl?: string;
  /** MIME type of the image */
  mimeType?: string;
  /** Whether data came from cache */
  fromCache?: boolean;
  /** Whether fallback image was used */
  isFallback?: boolean;
  /** Error message if retrieval failed */
  error?: string;
}

/**
 * Extracts the S3 key from a public URL
 * Supports both custom AWS_PUBLIC_URL and default S3 URL formats
 */
export function extractS3Key(publicUrl: string): string {
  if (process.env.AWS_PUBLIC_URL && publicUrl.startsWith(process.env.AWS_PUBLIC_URL)) {
    return publicUrl.replace(`${process.env.AWS_PUBLIC_URL}/`, "");
  }

  // Default AWS S3 URL format: https://{bucket}.s3.{region}.amazonaws.com/{key}
  const urlParts = new URL(publicUrl);
  return urlParts.pathname.substring(1); // Remove leading slash
}

/**
 * Constructs a public URL from an S3 key
 */
export function constructPublicUrl(key: string): string {
  if (process.env.AWS_PUBLIC_URL) {
    return `${process.env.AWS_PUBLIC_URL}/${key}`;
  }

  const region = process.env.AWS_REGION || "us-east-1";
  const bucket = process.env.AWS_BUCKET_NAME;
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Cleans up expired cache entries and enforces max cache size
 */
function cleanupCache(): void {
  const now = new Date();

  // Remove expired entries
  for (const [key, entry] of imageCache.entries()) {
    if (entry.expiresAt < now) {
      imageCache.delete(key);
    }
  }

  // If still over max size, remove oldest entries
  if (imageCache.size > MAX_CACHE_ENTRIES) {
    const entries = Array.from(imageCache.entries()).sort(
      (a, b) => a[1].fetchedAt.getTime() - b[1].fetchedAt.getTime()
    );

    const toRemove = entries.slice(0, imageCache.size - MAX_CACHE_ENTRIES);
    for (const [key] of toRemove) {
      imageCache.delete(key);
    }
  }
}

/**
 * Normalizes image format using Sharp
 * Converts unsupported formats (AVIF, etc.) to target format
 */
async function normalizeImageFormat(
  imageBuffer: Buffer,
  mimeType: string,
  options: { targetFormat?: "jpeg" | "png" | "webp"; quality?: number } = {}
): Promise<{ buffer: Buffer; mimeType: string }> {
  const { targetFormat = "jpeg", quality = 90 } = options;

  const supportedFormats = ["image/jpeg", "image/png", "image/webp"];

  // If already in a supported format and matches target, return as-is
  if (supportedFormats.includes(mimeType)) {
    const currentFormat = mimeType.split("/")[1];
    if (currentFormat === targetFormat) {
      return { buffer: imageBuffer, mimeType };
    }
  }

  try {
    let sharpInstance = sharp(imageBuffer);

    switch (targetFormat) {
      case "jpeg":
        sharpInstance = sharpInstance.jpeg({ quality });
        break;
      case "png":
        sharpInstance = sharpInstance.png({ quality });
        break;
      case "webp":
        sharpInstance = sharpInstance.webp({ quality });
        break;
    }

    const convertedBuffer = await sharpInstance.toBuffer();
    return {
      buffer: convertedBuffer,
      mimeType: `image/${targetFormat}`,
    };
  } catch (error) {
    console.warn(`Failed to convert image from ${mimeType} to ${targetFormat}:`, error);
    // Return original if conversion fails
    return { buffer: imageBuffer, mimeType };
  }
}

/**
 * Fetches avatar image directly from S3 using GetObjectCommand
 */
async function fetchFromS3(key: string): Promise<{ data: Buffer; mimeType: string; eTag?: string }> {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error("Empty response body from S3");
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  const data = Buffer.concat(chunks);

  return {
    data,
    mimeType: response.ContentType || "image/jpeg",
    eTag: response.ETag,
  };
}

/**
 * Fetches avatar image via HTTP (public URL)
 * Used as fallback when S3 direct access fails
 */
async function fetchViaHttp(publicUrl: string): Promise<{ data: Buffer; mimeType: string }> {
  const response = await fetch(publicUrl);

  if (!response.ok) {
    throw new Error(`HTTP fetch failed: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeType = response.headers.get("content-type") || "image/jpeg";

  return {
    data: Buffer.from(arrayBuffer),
    mimeType,
  };
}

/**
 * Generates a presigned download URL for an avatar image
 */
export async function getAvatarPresignedUrl(
  publicUrl: string,
  expiresIn: number = 300
): Promise<string> {
  const key = extractS3Key(publicUrl);

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Checks if an avatar image exists in S3
 */
export async function checkAvatarExists(publicUrl: string): Promise<boolean> {
  try {
    const key = extractS3Key(publicUrl);

    const command = new HeadObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Main function to retrieve an avatar image with caching and fallback
 *
 * Retrieval strategy:
 * 1. Check in-memory cache
 * 2. Try direct S3 fetch
 * 3. Fall back to HTTP fetch via public URL
 * 4. Return placeholder image if all methods fail
 */
export async function getAvatarImage(
  publicUrl: string,
  options: AvatarRetrievalOptions = {}
): Promise<AvatarImageResult> {
  const {
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    skipCache = false,
    usePresignedUrl = false,
    presignedUrlExpiresIn = 300,
    normalizeFormat = true,
    targetFormat = "jpeg",
    quality = 90,
  } = options;

  // If only presigned URL is requested, generate and return it
  if (usePresignedUrl) {
    try {
      const presignedUrl = await getAvatarPresignedUrl(publicUrl, presignedUrlExpiresIn);
      return {
        success: true,
        presignedUrl,
        publicUrl,
        fromCache: false,
        isFallback: false,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to generate presigned URL: ${error instanceof Error ? error.message : String(error)}`,
        isFallback: false,
      };
    }
  }

  const cacheKey = publicUrl;

  // Check cache first (unless skipCache is true)
  if (!skipCache) {
    const cached = imageCache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      const base64 = cached.data.toString("base64");
      return {
        success: true,
        data: cached.data,
        base64,
        dataUrl: `data:${cached.mimeType};base64,${base64}`,
        publicUrl,
        mimeType: cached.mimeType,
        fromCache: true,
        isFallback: false,
      };
    }
  }

  let imageData: Buffer | null = null;
  let mimeType: string = "image/jpeg";
  let eTag: string | undefined;

  // Try S3 direct fetch first
  try {
    const key = extractS3Key(publicUrl);
    const result = await fetchFromS3(key);
    imageData = result.data;
    mimeType = result.mimeType;
    eTag = result.eTag;
  } catch (s3Error) {
    console.warn("S3 direct fetch failed, trying HTTP fallback:", s3Error);

    // Try HTTP fetch as fallback
    try {
      const result = await fetchViaHttp(publicUrl);
      imageData = result.data;
      mimeType = result.mimeType;
    } catch (httpError) {
      console.error("Both S3 and HTTP fetch failed:", { s3Error, httpError });
    }
  }

  // If we got image data, optionally normalize format and cache it
  if (imageData) {
    // Normalize format if requested
    if (normalizeFormat) {
      const normalized = await normalizeImageFormat(imageData, mimeType, {
        targetFormat,
        quality,
      });
      imageData = normalized.buffer;
      mimeType = normalized.mimeType;
    }

    // Cache the result
    const now = new Date();
    imageCache.set(cacheKey, {
      data: imageData,
      mimeType,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + cacheTtlMs),
      eTag,
    });

    // Cleanup old cache entries periodically
    cleanupCache();

    const base64 = imageData.toString("base64");
    return {
      success: true,
      data: imageData,
      base64,
      dataUrl: `data:${mimeType};base64,${base64}`,
      publicUrl,
      mimeType,
      fromCache: false,
      isFallback: false,
    };
  }

  // Return fallback placeholder image
  console.error("All avatar retrieval methods failed, using fallback placeholder");
  return {
    success: false,
    data: Buffer.from(FALLBACK_PLACEHOLDER_BASE64, "base64"),
    base64: FALLBACK_PLACEHOLDER_BASE64,
    dataUrl: `data:image/png;base64,${FALLBACK_PLACEHOLDER_BASE64}`,
    publicUrl,
    mimeType: "image/png",
    fromCache: false,
    isFallback: true,
    error: "All retrieval methods failed",
  };
}

/**
 * Batch retrieval of multiple avatar images
 * Fetches images in parallel for better performance
 */
export async function getAvatarImages(
  publicUrls: string[],
  options: AvatarRetrievalOptions = {}
): Promise<Map<string, AvatarImageResult>> {
  const results = new Map<string, AvatarImageResult>();

  const promises = publicUrls.map(async (url) => {
    const result = await getAvatarImage(url, options);
    results.set(url, result);
  });

  await Promise.all(promises);

  return results;
}

/**
 * Retrieves avatar image specifically formatted for video generation
 * Returns base64-encoded JPEG suitable for Veo API
 */
export async function getAvatarForVideoGeneration(
  publicUrl: string,
  options: Omit<AvatarRetrievalOptions, "usePresignedUrl" | "normalizeFormat" | "targetFormat"> = {}
): Promise<{ success: boolean; base64: string; mimeType: string; error?: string }> {
  const result = await getAvatarImage(publicUrl, {
    ...options,
    usePresignedUrl: false,
    normalizeFormat: true,
    targetFormat: "jpeg",
    quality: options.quality || 90,
  });

  if (!result.success || !result.base64) {
    return {
      success: false,
      base64: FALLBACK_PLACEHOLDER_BASE64,
      mimeType: "image/png",
      error: result.error || "Failed to retrieve avatar image",
    };
  }

  return {
    success: true,
    base64: result.base64,
    mimeType: result.mimeType || "image/jpeg",
  };
}

/**
 * Clears the avatar image cache
 * Useful for testing or when forcing fresh fetches
 */
export function clearAvatarCache(): void {
  imageCache.clear();
}

/**
 * Gets current cache statistics
 */
export function getAvatarCacheStats(): {
  size: number;
  maxSize: number;
  entries: Array<{ key: string; fetchedAt: Date; expiresAt: Date }>;
} {
  return {
    size: imageCache.size,
    maxSize: MAX_CACHE_ENTRIES,
    entries: Array.from(imageCache.entries()).map(([key, entry]) => ({
      key,
      fetchedAt: entry.fetchedAt,
      expiresAt: entry.expiresAt,
    })),
  };
}

/**
 * Invalidates a specific avatar from cache
 */
export function invalidateAvatarCache(publicUrl: string): boolean {
  return imageCache.delete(publicUrl);
}

/**
 * Preloads avatar images into cache
 * Useful for warming cache before video generation batch
 */
export async function preloadAvatarImages(
  publicUrls: string[],
  options: AvatarRetrievalOptions = {}
): Promise<{ loaded: number; failed: number; errors: string[] }> {
  const errors: string[] = [];
  let loaded = 0;
  let failed = 0;

  const results = await getAvatarImages(publicUrls, { ...options, skipCache: true });

  for (const [url, result] of results) {
    if (result.success && !result.isFallback) {
      loaded++;
    } else {
      failed++;
      if (result.error) {
        errors.push(`${url}: ${result.error}`);
      }
    }
  }

  return { loaded, failed, errors };
}
