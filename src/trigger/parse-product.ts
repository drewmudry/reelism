import { task, logger } from "@trigger.dev/sdk/v3";
import { db } from "@/index";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateTextFlash } from "@/lib/ai";

/**
 * Extract metadata from HTML using standard metadata signals
 */
function extractMetadata(html: string, url: string): {
  title?: string;
  description?: string;
  price?: string;
  images?: string[];
} {
  const metadata: {
    title?: string;
    description?: string;
    price?: string;
    images?: string[];
  } = {};

  // Extract og:title
  const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  if (ogTitleMatch) {
    metadata.title = ogTitleMatch[1];
  }

  // Extract og:description
  const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
  if (ogDescMatch) {
    metadata.description = ogDescMatch[1];
  }

  // Extract og:image
  const ogImageMatches = html.matchAll(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/gi);
  const ogImages: string[] = [];
  for (const match of ogImageMatches) {
    let imageUrl = match[1];
    // Convert relative URLs to absolute
    if (imageUrl.startsWith("//")) {
      imageUrl = `https:${imageUrl}`;
    } else if (imageUrl.startsWith("/")) {
      const baseUrl = new URL(url);
      imageUrl = `${baseUrl.origin}${imageUrl}`;
    }
    ogImages.push(imageUrl);
  }
  if (ogImages.length > 0) {
    metadata.images = ogImages;
  }

  // Extract product:price
  const priceMatch = html.match(/<meta\s+property=["']product:price["']\s+content=["']([^"']+)["']/i);
  if (priceMatch) {
    metadata.price = priceMatch[1];
  }

  // Extract meta description
  if (!metadata.description) {
    const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    if (metaDescMatch) {
      metadata.description = metaDescMatch[1];
    }
  }

  // Extract title tag
  if (!metadata.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      metadata.title = titleMatch[1].trim();
    }
  }

  // Extract JSON-LD schema.org data
  const jsonLdMatches = html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdMatches) {
    try {
      const jsonLd = JSON.parse(match[1]);
      
      // Handle Product schema
      if (jsonLd["@type"] === "Product" || jsonLd["@type"] === "http://schema.org/Product") {
        if (jsonLd.name && !metadata.title) {
          metadata.title = jsonLd.name;
        }
        if (jsonLd.description && !metadata.description) {
          metadata.description = jsonLd.description;
        }
        if (jsonLd.offers) {
          const offers = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
          if (offers.price && !metadata.price) {
            metadata.price = typeof offers.price === "string" ? offers.price : offers.price.toString();
          }
        }
        if (jsonLd.image) {
          const images = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image];
          const absoluteImages = images.map((img: string) => {
            if (img.startsWith("//")) {
              return `https:${img}`;
            } else if (img.startsWith("/")) {
              const baseUrl = new URL(url);
              return `${baseUrl.origin}${img}`;
            }
            return img;
          });
          if (absoluteImages.length > 0 && !metadata.images) {
            metadata.images = absoluteImages;
          }
        }
      }
    } catch (e) {
      // Skip invalid JSON-LD
      logger.log("Failed to parse JSON-LD", { error: e });
    }
  }

  return metadata;
}

/**
 * Use LLM to refine and structure product data from HTML
 */
async function refineMetadataWithLLM(
  html: string,
  extractedMetadata: ReturnType<typeof extractMetadata>,
  url: string
): Promise<{
  title: string | null;
  description: string | null;
  price: string | null;
  images: string[];
}> {
  // Create a prompt for the LLM
  const prompt = `You are a product data extraction expert. Extract product information from the following HTML content and metadata.

URL: ${url}

Extracted metadata:
- Title: ${extractedMetadata.title || "Not found"}
- Description: ${extractedMetadata.description || "Not found"}
- Price: ${extractedMetadata.price || "Not found"}
- Images: ${extractedMetadata.images?.join(", ") || "Not found"}

HTML content (first 10000 characters):
${html.substring(0, 10000)}

Please extract and return a JSON object with the following structure:
{
  "title": "Product title (string, required)",
  "description": "Product description (string, can be null)",
  "price": "Price as a number string like "29.99" (string, can be null)",
  "images": ["url1", "url2", ...] (array of image URLs, at least one required)
}

Rules:
1. Title must be a clear, concise product name
2. Description should be informative but concise (max 500 characters)
3. Price should be a numeric string (e.g., "29.99", "129.00") or null if not found
4. Images must be absolute URLs (convert relative URLs to absolute using the base URL: ${url})
5. Include at least one image URL if available
6. Only return valid JSON, no markdown formatting

Return ONLY the JSON object, nothing else.`;

  try {
    const response = await generateTextFlash(prompt, {
      temperature: 0.3,
      maxOutputTokens: 2000,
    });

    // Parse the JSON response
    let llmData: {
      title: string;
      description?: string | null;
      price?: string | null;
      images: string[];
    };

    // Try to extract JSON from the response (might be wrapped in markdown)
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      llmData = JSON.parse(jsonMatch[0]);
    } else {
      llmData = JSON.parse(response.text);
    }

    // Validate and normalize
    if (!llmData.title || typeof llmData.title !== "string") {
      throw new Error("LLM did not return a valid title");
    }

    if (!llmData.images || !Array.isArray(llmData.images) || llmData.images.length === 0) {
      // Fallback to extracted images if LLM didn't provide any
      llmData.images = extractedMetadata.images || [];
    }

    // Convert relative image URLs to absolute
    const baseUrl = new URL(url);
    llmData.images = llmData.images.map((img) => {
      if (img.startsWith("//")) {
        return `https:${img}`;
      } else if (img.startsWith("/")) {
        return `${baseUrl.origin}${img}`;
      } else if (!img.startsWith("http")) {
        return `${baseUrl.origin}/${img}`;
      }
      return img;
    });

    return {
      title: llmData.title.trim(),
      description: llmData.description?.trim() || null,
      price: llmData.price || null,
      images: llmData.images,
    };
  } catch (error) {
    logger.error("LLM extraction failed, using extracted metadata", { error });
    
    // Fallback to extracted metadata
    return {
      title: extractedMetadata.title || null,
      description: extractedMetadata.description || null,
      price: extractedMetadata.price || null,
      images: extractedMetadata.images || [],
    };
  }
}

export const parseProductTask = task({
  id: "parse-product",
  maxDuration: 300, // 5 minutes
  run: async (payload: { productId: string }) => {
    logger.log("Starting product parsing", { productId: payload.productId });

    try {
      // Fetch the product record
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, payload.productId))
        .limit(1);

      if (!product) {
        throw new Error(`Product with id ${payload.productId} not found`);
      }

      if (!product.sourceUrl) {
        throw new Error("Product source URL is missing");
      }

      if (product.type !== "external") {
        throw new Error("Product is not an external product");
      }

      logger.log("Fetching HTML from URL", { url: product.sourceUrl });

      // Fetch page HTML safely
      const response = await fetch(product.sourceUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      logger.log("HTML fetched successfully", { htmlLength: html.length });

      // Extract metadata using standard signals
      const extractedMetadata = extractMetadata(html, product.sourceUrl);
      logger.log("Metadata extracted", { extractedMetadata });

      // Refine with LLM
      logger.log("Refining metadata with LLM...");
      const refinedData = await refineMetadataWithLLM(html, extractedMetadata, product.sourceUrl);
      logger.log("Metadata refined", { refinedData });

      // Validate that we have at least a title
      if (!refinedData.title) {
        throw new Error("Could not extract product title");
      }

      // Update the product record
      await db
        .update(products)
        .set({
          title: refinedData.title,
          description: refinedData.description,
          price: refinedData.price,
          images: refinedData.images,
          parsed: true,
          error: null,
          updatedAt: new Date(),
        })
        .where(eq(products.id, payload.productId));

      logger.log("Product parsed successfully", {
        productId: payload.productId,
        title: refinedData.title,
      });

      return {
        success: true,
        productId: payload.productId,
        title: refinedData.title,
      };
    } catch (error) {
      // Update product with error
      try {
        await db
          .update(products)
          .set({
            parsed: true,
            error: error instanceof Error ? error.message : String(error),
            updatedAt: new Date(),
          })
          .where(eq(products.id, payload.productId));
      } catch (updateError) {
        logger.error("Failed to update product with error", { error: updateError });
      }

      logger.error("Product parsing failed", {
        productId: payload.productId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});
