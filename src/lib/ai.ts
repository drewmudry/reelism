import { GoogleGenAI, PersonGeneration } from '@google/genai';

// Initialize the Google GenAI client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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

