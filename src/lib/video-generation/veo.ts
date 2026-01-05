import { generateVideo } from "@/lib/ai";
import { uploadToStorage } from "./storage-helper";

export async function generateVeoClip(params: {
  sourceImageUrl: string;
  prompt: string;
}): Promise<{ url: string; buffer: Buffer }> {
  // Use generateVideo from ai.ts
  const video = await generateVideo(params.prompt, params.sourceImageUrl, {
    duration: 8,
    disableAudio: true, // Audio comes from Veo generation
  });

  // Convert base64 to buffer
  const buffer = Buffer.from(video.videoBytes, "base64");
  
  // Upload to storage
  const url = await uploadToStorage(buffer, `veo-clips/${Date.now()}.mp4`, "video/mp4");
  
  return { url, buffer };
}

