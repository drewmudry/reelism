import { GoogleGenAI, PersonGeneration, VideoGenerationReferenceType } from '@google/genai';
import sharp from 'sharp';

// Initialize the Google GenAI client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/**
 * Supported MIME types for Google GenAI API
 */
const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png'];

/**
 * Converts an image buffer to JPEG if it's in an unsupported format
 * @param imageBuffer - The image buffer to convert
 * @param mimeType - The original MIME type of the image
 * @returns Promise resolving to converted image buffer and MIME type
 */
async function normalizeImageFormat(
  imageBuffer: ArrayBuffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  // If the format is already supported, return as-is
  if (SUPPORTED_MIME_TYPES.includes(mimeType)) {
    return {
      buffer: Buffer.from(imageBuffer),
      mimeType,
    };
  }

  // Convert unsupported formats (like AVIF) to JPEG
  try {
    const convertedBuffer = await sharp(Buffer.from(imageBuffer))
      .jpeg({ quality: 90 })
      .toBuffer();

    return {
      buffer: convertedBuffer,
      mimeType: 'image/jpeg',
    };
  } catch (error) {
    console.warn(`Failed to convert image from ${mimeType} to JPEG, using original:`, error);
    // Fallback to original if conversion fails
    return {
      buffer: Buffer.from(imageBuffer),
      mimeType: 'image/jpeg', // Still set to JPEG as fallback
    };
  }
}

/**
 * Configuration options for image generation
 */
export interface ImageGenerationOptions {
  /** Number of images to generate (1-4) */
  numberOfImages?: number;
  /** Aspect ratio: "3:4" or "9:16" (vertical only) */
  aspectRatio?: '3:4' | '9:16';
  /** Image size: "1K" or "2K" */
  imageSize?: '1K' | '2K';
  /** Output MIME type: "image/jpeg" or "image/png" */
  outputMimeType?: 'image/jpeg' | 'image/png';
  /** Whether to include RAI (Responsible AI) filter reasons */
  includeRaiReason?: boolean;
  /** Person generation policy */
  personGeneration?: PersonGeneration;
}

/**
 * Configuration options for text generation
 */
export interface TextGenerationOptions {
  /** Maximum number of output tokens */
  maxOutputTokens?: number;
  /** Temperature for randomness (0.0 to 1.0) */
  temperature?: number;
  /** Top-p sampling parameter */
  topP?: number;
  /** Top-k sampling parameter */
  topK?: number;
}

/**
 * Response from image generation
 */
export interface ImageGenerationResponse {
  /** Base64 encoded image data */
  imageBytes: string;
  /** Data URL for direct use in img src attribute */
  dataUrl: string;
  /** Enhanced prompt used for generation (if available) */
  enhancedPrompt?: string;
  /** RAI filter reason (if image was filtered) */
  raiFilteredReason?: string;
}

/**
 * Response from text generation
 */
export interface TextGenerationResponse {
  /** Generated text content */
  text: string;
  /** Token usage metadata */
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  /** Finish reason */
  finishReason?: string;
}

/**
 * Generate images using Nano Banana Pro (Gemini 3 Pro Image)
 * 
 * @param prompt - Text description of the image to generate
 * @param options - Optional configuration for image generation
 * @returns Promise resolving to an array of generated images
 * 
 * @example
 * ```typescript
 * const images = await generateImage('A serene mountain landscape at sunset');
 * const firstImage = images[0];
 * // Use firstImage.dataUrl directly in an <img> src attribute
 * ```
 */
export async function generateImage(
  prompt: string,
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResponse[]> {
  const {
    numberOfImages = 1,
    aspectRatio = '9:16',
    imageSize = '1K',
    outputMimeType = 'image/jpeg',
    includeRaiReason = false,
    personGeneration = PersonGeneration.ALLOW_ADULT,
  } = options;

  try {
    // Use gemini-3-pro-image-preview with proper Imagen configuration
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: prompt,
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: imageSize,
        },
      },
    });

    // Extract image data from the response
    const images: ImageGenerationResponse[] = [];

    if (response.candidates && response.candidates.length > 0) {
      for (const candidate of response.candidates) {
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData?.data) {
              const imageBytes = part.inlineData.data;
              const mimeType = part.inlineData.mimeType || outputMimeType;
              const dataUrl = `data:${mimeType};base64,${imageBytes}`;

              images.push({
                imageBytes,
                dataUrl,
              });

              // Limit to requested number of images
              if (images.length >= numberOfImages) {
                break;
              }
            }
          }
        }
      }
    }

    if (images.length === 0) {
      throw new Error('No images were generated');
    }

    return images;
  } catch (error) {
    // Fallback to Imagen model if Gemini image model is not available
    try {
      const response = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt,
        config: {
          numberOfImages,
          aspectRatio, // Only "3:4" or "9:16" are allowed
          outputMimeType,
          includeRaiReason,
          personGeneration,
        },
      });

      if (!response.generatedImages || response.generatedImages.length === 0) {
        throw new Error('No images were generated');
      }

      return response.generatedImages.map((img) => {
        if (!img.image?.imageBytes) {
          throw new Error('Image data is missing from response');
        }

        const imageBytes = img.image.imageBytes;
        const mimeType = outputMimeType;
        const dataUrl = `data:${mimeType};base64,${imageBytes}`;

        return {
          imageBytes,
          dataUrl,
          enhancedPrompt: img.enhancedPrompt,
          raiFilteredReason: img.raiFilteredReason,
        };
      });
    } catch (fallbackError) {
      console.error('Image generation error (both methods failed):', {
        primaryError: error,
        fallbackError,
      });
      throw error; // Throw original error
    }
  }
}

/**
 * Generate images from a reference image and text instructions (image-to-image)
 * 
 * @param referenceImageUrl - URL of the reference image to use as a base
 * @param instructions - Text instructions describing the changes to make (e.g., "change her shirt to a black spaghetti strap tank top")
 * @param options - Optional configuration for image generation
 * @returns Promise resolving to an array of generated images
 * 
 * @example
 * ```typescript
 * const images = await generateImageFromReference('https://example.com/avatar.jpg', 'change her shirt to a black spaghetti strap tank top');
 * const firstImage = images[0];
 * // Use firstImage.dataUrl directly in an <img> src attribute
 * ```
 */
export async function generateImageFromReference(
  referenceImageUrl: string,
  instructions: string,
  options: ImageGenerationOptions = {},
  productImageUrls?: string[]
): Promise<ImageGenerationResponse[]> {
  const {
    numberOfImages = 1,
    aspectRatio = '9:16',
    imageSize = '1K',
    outputMimeType = 'image/jpeg',
    includeRaiReason = false,
    personGeneration = PersonGeneration.ALLOW_ADULT,
  } = options;

  try {
    // Fetch the reference image
    const imageResponse = await fetch(referenceImageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch reference image: ${imageResponse.statusText}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const originalMimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
    
    // Normalize image format (convert AVIF and other unsupported formats to JPEG)
    const { buffer: normalizedBuffer, mimeType: normalizedMimeType } = await normalizeImageFormat(
      imageBuffer,
      originalMimeType
    );
    
    const imageBytes = normalizedBuffer.toString('base64');

    // Prepare prompt parts
    const parts: any[] = [
      {
        inlineData: {
          data: imageBytes,
          mimeType: normalizedMimeType,
        },
      },
    ];

    let finalPrompt = `Based on this reference image, generate a new image with the following modifications: ${instructions}. Keep everything else the same, only apply the requested changes.`;

    // Fetch and add product images if provided
    if (productImageUrls && productImageUrls.length > 0) {
      let imageIndex = 2;
      for (const productImageUrl of productImageUrls) {
        try {
          const productResponse = await fetch(productImageUrl);
          if (productResponse.ok) {
            const productBuffer = await productResponse.arrayBuffer();
            const originalProductMimeType = productResponse.headers.get('content-type') || 'image/jpeg';
            
            // Normalize image format (convert AVIF and other unsupported formats to JPEG)
            const { buffer: normalizedProductBuffer, mimeType: normalizedProductMimeType } = await normalizeImageFormat(
              productBuffer,
              originalProductMimeType
            );
            
            const productBytes = normalizedProductBuffer.toString('base64');

            parts.push({
              inlineData: {
                data: productBytes,
                mimeType: normalizedProductMimeType,
              },
            });
            imageIndex++;
          } else {
            console.warn(`Failed to fetch product image: ${productImageUrl} - ${productResponse.statusText}`);
          }
        } catch (error) {
          console.warn(`Error fetching product image: ${productImageUrl}`, error);
        }
      }

      if (productImageUrls.length === 1) {
        finalPrompt += ` Use the second image as a reference for the product to include/wear.`;
      } else if (productImageUrls.length > 1) {
        finalPrompt += ` Use the additional images as references for the products to include/wear.`;
      }
    }

    parts.push({ text: finalPrompt });

    // Create a multimodal prompt with the reference image(s) and instructions
    const contents = [
      {
        parts: parts,
      },
    ];

    // Use gemini-3-pro-image-preview with multimodal input
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: contents,
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: imageSize,
        },
      },
    });

    // Extract image data from the response
    const images: ImageGenerationResponse[] = [];

    if (response.candidates && response.candidates.length > 0) {
      for (const candidate of response.candidates) {
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData?.data) {
              const generatedImageBytes = part.inlineData.data;
              const mimeType = part.inlineData.mimeType || outputMimeType;
              const dataUrl = `data:${mimeType};base64,${generatedImageBytes}`;

              images.push({
                imageBytes: generatedImageBytes,
                dataUrl,
              });

              // Limit to requested number of images
              if (images.length >= numberOfImages) {
                break;
              }
            }
          }
        }
      }
    }

    if (images.length === 0) {
      throw new Error('No images were generated');
    }

    return images;
  } catch (error) {
    console.error('Image-to-image generation error:', error);
    throw error;
  }
}

/**
 * Generate text using Gemini 3 Pro
 * 
 * @param prompt - Text prompt for generation
 * @param options - Optional configuration for text generation
 * @returns Promise resolving to generated text response
 * 
 * @example
 * ```typescript
 * const response = await generateTextPro('Explain quantum computing in simple terms');
 * console.log(response.text);
 * ```
 */
export async function generateTextPro(
  prompt: string,
  options: TextGenerationOptions = {}
): Promise<TextGenerationResponse> {
  const {
    maxOutputTokens = 8192,
    temperature = 0.7,
    topP = 0.9,
    topK = 40,
  } = options;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro', // Gemini 3 Pro
      contents: prompt,
      config: {
        maxOutputTokens,
        temperature,
        topP,
        topK,
      },
    });

    if (!response.text) {
      throw new Error('No text was generated');
    }

    return {
      text: response.text,
      usageMetadata: {
        promptTokenCount: response.usageMetadata?.promptTokenCount,
        candidatesTokenCount: response.usageMetadata?.candidatesTokenCount,
        totalTokenCount: response.usageMetadata?.totalTokenCount,
      },
      finishReason: response.candidates?.[0]?.finishReason,
    };
  } catch (error) {
    console.error('Text generation error:', error);
    throw error;
  }
}

/**
 * Generate text using Gemini 3 Flash (faster, more cost-effective)
 * 
 * @param prompt - Text prompt for generation
 * @param options - Optional configuration for text generation
 * @returns Promise resolving to generated text response
 * 
 * @example
 * ```typescript
 * const response = await generateTextFlash('Why is the sky blue?');
 * console.log(response.text);
 * ```
 */
export async function generateTextFlash(
  prompt: string,
  options: TextGenerationOptions = {}
): Promise<TextGenerationResponse> {
  const {
    maxOutputTokens = 8192,
    temperature = 0.7,
    topP = 0.9,
    topK = 40,
  } = options;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash', // Gemini 3 Flash
      contents: prompt,
      config: {
        maxOutputTokens,
        temperature,
        topP,
        topK,
      },
    });

    if (!response.text) {
      throw new Error('No text was generated');
    }

    return {
      text: response.text,
      usageMetadata: {
        promptTokenCount: response.usageMetadata?.promptTokenCount,
        candidatesTokenCount: response.usageMetadata?.candidatesTokenCount,
        totalTokenCount: response.usageMetadata?.totalTokenCount,
      },
      finishReason: response.candidates?.[0]?.finishReason,
    };
  } catch (error) {
    console.error('Text generation error:', error);
    throw error;
  }
}

/**
 * Stream text generation using Gemini 3 Flash
 * 
 * @param prompt - Text prompt for generation
 * @param options - Optional configuration for text generation
 * @returns AsyncGenerator yielding text chunks
 * 
 * @example
 * ```typescript
 * for await (const chunk of generateTextFlashStream('Tell me a story')) {
 *   process.stdout.write(chunk.text);
 * }
 * ```
 */
export async function* generateTextFlashStream(
  prompt: string,
  options: TextGenerationOptions = {}
): AsyncGenerator<{ text: string; finishReason?: string }> {
  const {
    maxOutputTokens = 8192,
    temperature = 0.7,
    topP = 0.9,
    topK = 40,
  } = options;

  try {
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash', // Gemini 3 Flash
      contents: prompt,
      config: {
        maxOutputTokens,
        temperature,
        topP,
        topK,
      },
    });

    for await (const chunk of response) {
      if (chunk.text) {
        yield {
          text: chunk.text,
          finishReason: chunk.candidates?.[0]?.finishReason,
        };
      }
    }
  } catch (error) {
    console.error('Streaming text generation error:', error);
    throw error;
  }
}

/**
 * Stream text generation using Gemini 3 Pro
 * 
 * @param prompt - Text prompt for generation
 * @param options - Optional configuration for text generation
 * @returns AsyncGenerator yielding text chunks
 * 
 * @example
 * ```typescript
 * for await (const chunk of generateTextProStream('Explain quantum computing')) {
 *   process.stdout.write(chunk.text);
 * }
 * ```
 */
export async function* generateTextProStream(
  prompt: string,
  options: TextGenerationOptions = {}
): AsyncGenerator<{ text: string; finishReason?: string }> {
  const {
    maxOutputTokens = 8192,
    temperature = 0.7,
    topP = 0.9,
    topK = 40,
  } = options;

  try {
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-pro', // Gemini 3 Pro
      contents: prompt,
      config: {
        maxOutputTokens,
        temperature,
        topP,
        topK,
      },
    });

    for await (const chunk of response) {
      if (chunk.text) {
        yield {
          text: chunk.text,
          finishReason: chunk.candidates?.[0]?.finishReason,
        };
      }
    }
  } catch (error) {
    console.error('Streaming text generation error:', error);
    throw error;
  }
}

/**
 * Configuration options for video generation
 */
export interface VideoGenerationOptions {
  /** 
   * Reference image(s) to guide the video generation (base64 encoded)
   * NOTE: This is currently unused. The avatar image is passed via the `image` parameter
   * instead of `referenceImages` because `referenceImages` only supports 16:9 aspect ratio.
   * Veo 3.1 preview does NOT support mixing avatar (SUBJECT) + product (ASSET) in same request.
   */
  referenceImages?: string[];
  /** Duration of the video in seconds */
  duration?: number;
  /** Whether to disable audio generation (default: true) */
  disableAudio?: boolean;
  /** Driver video URL for character controls - animates the avatar image using movements from this video */
  driverVideoUrl?: string;
}

/**
 * Response from video generation
 */
export interface VideoGenerationResponse {
  /** Base64 encoded video data */
  videoBytes: string;
  /** Data URL for direct use in video src attribute */
  dataUrl: string;
  /** Operation ID for polling status */
  operationId?: string;
}

/**
 * Helper function to fetch and normalize an image
 */
async function fetchAndNormalize(imageUrl: string): Promise<{ bytes: string; mimeType: string }> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  
  const buffer = await response.arrayBuffer();
  const originalMimeType = response.headers.get('content-type') || 'image/jpeg';
  
  const { buffer: normalizedBuffer, mimeType: normalizedMimeType } = await normalizeImageFormat(
    buffer,
    originalMimeType
  );
  
  return {
    bytes: normalizedBuffer.toString('base64'),
    mimeType: normalizedMimeType,
  };
}

/**
 * Generate videos using Veo 3.1 from an image and prompt
 * 
 * @param prompt - Text description of the animation/video to generate
 * @param imageUrl - URL of the avatar image to animate
 * @param options - Optional configuration for video generation
 * @returns Promise resolving to generated video
 * 
 * @example
 * ```typescript
 * const video = await generateVideo('A gentle swaying motion', 'https://example.com/avatar.jpg');
 * // Use video.dataUrl directly in a <video> src attribute
 * ```
 */
export async function generateVideo(
  prompt: string,
  imageUrl: string,
  options: VideoGenerationOptions = {}
): Promise<VideoGenerationResponse> {
  try {
    // 1. Process the Avatar Image (The person/character)
    const avatarData = await fetchAndNormalize(imageUrl);

    // 2. Prepare the Prompt
    // Keep it simple; avoid "CRITICAL INSTRUCTION" prefixes which can trigger filters
    let finalPrompt = prompt;
    if (options.disableAudio !== false) {
      // Use natural language instead of "CRITICAL" prefix
      finalPrompt = `A silent video with no audio. ${prompt}`;
    }

    // 3. Execute Generation
    // IMPORTANT: Use the `image` parameter instead of `referenceImages` in config
    // because `referenceImages` only supports 16:9 aspect ratio, but we need 9:16
    // The `image` parameter works for image-to-video without aspect ratio restrictions
    // 
    // Note: Veo 3.1 preview does NOT support mixing avatar + product in same request
    // So we only pass the avatar image here, no products
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt: finalPrompt,
      image: {
        imageBytes: avatarData.bytes,
        mimeType: avatarData.mimeType,
      },
      config: {
        aspectRatio: '9:16',
      },
    });

    // 6. Poll the operation status until the video is ready
    const maxAttempts = 60; // 10 minutes max (60 * 10 seconds)
    let attempts = 0;

    while (!operation.done && attempts < maxAttempts) {
      console.log("Waiting for video generation to complete...");
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds
      operation = await ai.operations.getVideosOperation({
        operation: operation,
      });
      attempts++;
    }

    if (!operation.done) {
      throw new Error('Video generation timed out');
    }

    if (!operation.response?.generatedVideos || operation.response.generatedVideos.length === 0) {
      throw new Error('No video was generated');
    }

    // 7. Download the generated video
    const videoFile = operation.response.generatedVideos[0].video;

    if (!videoFile) {
      throw new Error('Generated video file is missing from response');
    }

    // Use a temporary file path for download
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');

    const tempPath = path.join(os.tmpdir(), `veo-video-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`);

    await ai.files.download({
      file: videoFile,
      downloadPath: tempPath,
    });

    // Read the video file into a buffer
    const videoData = await fs.readFile(tempPath);

    // Clean up temp file
    await fs.unlink(tempPath).catch(() => { });

    // Convert video to base64
    const videoBytes = videoData.toString('base64');
    const videoMimeType = 'video/mp4'; // Veo typically generates MP4
    const dataUrl = `data:${videoMimeType};base64,${videoBytes}`;

    return {
      videoBytes,
      dataUrl,
      operationId: operation.name,
    }; 
  } catch (error) {
    console.error('Video generation error:', error);
    throw error;
  }
}

