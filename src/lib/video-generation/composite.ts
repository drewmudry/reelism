import { generateImageFromReference } from "@/lib/ai";
import { uploadToStorage } from "./storage-helper";

export async function generateCompositeImage(params: {
  avatarImageUrl: string;
  productImageUrls: string[];
  prompt: string;
}): Promise<string> {
  // Use generateImageFromReference with avatar as reference and product images
  const images = await generateImageFromReference(
    params.avatarImageUrl,
    params.prompt,
    {
      numberOfImages: 1,
      aspectRatio: "9:16",
      imageSize: "1K",
      outputMimeType: "image/png",
    },
    params.productImageUrls
  );

  if (images.length === 0) {
    throw new Error("Failed to generate composite image");
  }

  // Convert base64 to buffer and upload
  const imageBuffer = Buffer.from(images[0].imageBytes, "base64");
  return uploadToStorage(imageBuffer, `composites/${Date.now()}.png`, "image/png");
}

