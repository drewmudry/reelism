import { uploadImage, uploadVideo } from "@/lib/storage";

/**
 * Helper function to upload buffers to storage
 * Converts buffer to base64 and uses appropriate upload function
 */
export async function uploadToStorage(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const base64 = buffer.toString("base64");

  if (contentType.startsWith("image/")) {
    return uploadImage(base64, filename, contentType);
  } else if (contentType.startsWith("video/")) {
    return uploadVideo(base64, filename, contentType);
  } else if (contentType.startsWith("audio/")) {
    // Use uploadVideo for audio files (same S3 handling)
    return uploadVideo(base64, filename, contentType);
  } else {
    throw new Error(`Unsupported content type: ${contentType}`);
  }
}

