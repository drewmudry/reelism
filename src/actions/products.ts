"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/index";
import { products } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getPresignedUploadUrl } from "@/lib/storage";
import { generateTextFlash } from "@/lib/ai";

export interface CreateProductManuallyInput {
  title: string;
  description?: string;
  price?: number;
  imageUrls: string[]; // Array of S3 URLs (already uploaded)
}

export interface GetPresignedUrlInput {
  filename: string;
  contentType: string;
}

export interface UpdateProductInput {
  id: string;
  title?: string;
  description?: string;
  price?: number;
  images?: string[];
  hooks?: string[];
  ctas?: string[];
}

export interface GenerateHooksInput {
  title: string;
  description?: string;
}

export interface GenerateCTAsInput {
  title: string;
  description?: string;
}

/**
 * Get presigned URLs for direct S3 upload
 * Client calls this to get upload URLs, then uploads directly to S3
 */
export async function getPresignedUrls(input: GetPresignedUrlInput[]) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  try {
    const presignedUrls = await Promise.all(
      input.map(async (item) => {
        const filename = `products/${session.user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${item.contentType.split("/")[1] || "jpg"}`;
        const { uploadUrl, publicUrl } = await getPresignedUploadUrl(
          filename,
          item.contentType
        );
        return { uploadUrl, publicUrl };
      })
    );

    return presignedUrls;
  } catch (error) {
    console.error("Failed to generate presigned URLs:", error);
    throw error;
  }
}

/**
 * Add a product manually
 * User uploads images directly to S3, then sends URLs here
 */
export async function createProductManually(input: CreateProductManuallyInput) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  try {
    // Validate input
    if (!input.title || input.title.trim().length === 0) {
      throw new Error("Title is required");
    }

    if (!input.imageUrls || input.imageUrls.length === 0) {
      throw new Error("At least one image is required");
    }

    // Create product record with parsed=true (images already uploaded to S3)
    const [product] = await db
      .insert(products)
      .values({
        userId: session.user.id,
        type: "custom",
        title: input.title.trim(),
        description: input.description?.trim() || null,
        price: input.price ? input.price.toString() : null,
        images: input.imageUrls,
        parsed: true,
      })
      .returning();

    if (!product) {
      throw new Error("Failed to create product record");
    }

    return { productId: product.id };
  } catch (error) {
    console.error("Failed to create product manually:", error);
    throw error;
  }
}

/**
 * Get all products for the current user
 */
export async function getProducts() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  try {
    const userProducts = await db
      .select()
      .from(products)
      .where(eq(products.userId, session.user.id))
      .orderBy(desc(products.createdAt));

    return userProducts.map((product) => ({
      id: product.id,
      type: product.type,
      sourceUrl: product.sourceUrl,
      title: product.title,
      description: product.description,
      price: product.price ? parseFloat(product.price) : null,
      images: product.images,
      hooks: product.hooks,
      ctas: product.ctas,
      parsed: product.parsed,
      error: product.error,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }));
  } catch (error) {
    console.error("Failed to fetch products:", error);
    throw error;
  }
}

/**
 * Get a single product by ID
 */
export async function getProductById(productId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  try {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      throw new Error("Product not found");
    }

    // Verify ownership
    if (product.userId !== session.user.id) {
      throw new Error("Unauthorized");
    }

    return {
      id: product.id,
      type: product.type,
      sourceUrl: product.sourceUrl,
      title: product.title,
      description: product.description,
      price: product.price ? parseFloat(product.price) : null,
      images: product.images,
      hooks: product.hooks,
      ctas: product.ctas,
      parsed: product.parsed,
      error: product.error,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  } catch (error) {
    console.error("Failed to fetch product:", error);
    throw error;
  }
}

/**
 * Generate hooks for a product using AI
 * Creates TikTok Shop style video hooks
 */
export async function generateProductHooks(input: GenerateHooksInput) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  try {
    const prompt = `You are an expert TikTok Shop copywriter specializing in viral short-form video hooks. Generate 5 natural, engaging hooks for TikTok Shop-style short videos featuring this product:

Product: ${input.title}
${input.description ? `Description: ${input.description}` : ""}

Requirements for each hook:
- Must grab attention in the first 1-2 seconds
- Natural and conversational tone (NOT salesy or clickbait)
- Include action words and emotional triggers
- Optimized for TikTok's fast-paced format
- 6-15 words each
- Should feel authentic and relatable
- Can use questions, statements, or call-outs

Return ONLY a valid JSON array of 5 strings, no other text:
["hook1", "hook2", "hook3", "hook4", "hook5"]`;

    const response = await generateTextFlash(prompt, {
      temperature: 0.8,
      maxOutputTokens: 1024,
    });

    // Parse the JSON response
    let hooks: string[];
    try {
      // Extract JSON array from response (handle potential markdown code blocks)
      const jsonMatch = response.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("No JSON array found in response");
      }
      hooks = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(hooks) || hooks.length === 0) {
        throw new Error("Invalid hooks array");
      }

      // Ensure we have strings
      hooks = hooks.filter((h): h is string => typeof h === "string" && h.trim().length > 0);
    } catch (parseError) {
      console.error("Failed to parse hooks response:", response.text);
      throw new Error("Failed to parse generated hooks");
    }

    return { hooks };
  } catch (error) {
    console.error("Failed to generate product hooks:", error);
    throw error;
  }
}

/**
 * Generate CTAs (Call to Actions) for a product using AI
 * Creates compelling call-to-action phrases for TikTok Shop videos
 */
export async function generateProductCTAs(input: GenerateCTAsInput) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  try {
    const prompt = `You are an expert TikTok Shop copywriter specializing in compelling call-to-action phrases. Generate 5 natural, action-oriented CTAs for TikTok Shop-style short videos featuring this product:

Product: ${input.title}
${input.description ? `Description: ${input.description}` : ""}

Requirements for each CTA:
- Must drive action (purchase, click, learn more)
- Natural and conversational tone (NOT pushy or aggressive)
- Include urgency or value proposition when appropriate
- Optimized for TikTok's fast-paced format
- 3-10 words each
- Should feel authentic and compelling
- Can use direct commands, questions, or value statements
- Examples: "Shop now", "Get yours today", "Link in bio", "Limited time offer", "Try it yourself"

Return ONLY a valid JSON array of 5 strings, no other text:
["cta1", "cta2", "cta3", "cta4", "cta5"]`;

    const response = await generateTextFlash(prompt, {
      temperature: 0.8,
      maxOutputTokens: 1024,
    });

    // Parse the JSON response
    let ctas: string[];
    try {
      // Extract JSON array from response (handle potential markdown code blocks)
      const jsonMatch = response.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("No JSON array found in response");
      }
      ctas = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(ctas) || ctas.length === 0) {
        throw new Error("Invalid CTAs array");
      }

      // Ensure we have strings
      ctas = ctas.filter((c): c is string => typeof c === "string" && c.trim().length > 0);
    } catch (parseError) {
      console.error("Failed to parse CTAs response:", response.text);
      throw new Error("Failed to parse generated CTAs");
    }

    return { ctas };
  } catch (error) {
    console.error("Failed to generate product CTAs:", error);
    throw error;
  }
}

/**
 * Update a product
 * Allows editing title, description, price, images, hooks, and ctas
 */
export async function updateProduct(input: UpdateProductInput) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  try {
    // Verify ownership
    const [existing] = await db
      .select()
      .from(products)
      .where(eq(products.id, input.id))
      .limit(1);

    if (!existing) {
      throw new Error("Product not found");
    }

    if (existing.userId !== session.user.id) {
      throw new Error("Unauthorized");
    }

    // Build update object
    const updateData: Partial<typeof products.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.title !== undefined) {
      updateData.title = input.title.trim() || null;
    }
    if (input.description !== undefined) {
      updateData.description = input.description.trim() || null;
    }
    if (input.price !== undefined) {
      updateData.price = input.price ? input.price.toString() : null;
    }
    if (input.images !== undefined) {
      updateData.images = input.images;
    }
    if (input.hooks !== undefined) {
      updateData.hooks = input.hooks;
    }
    if (input.ctas !== undefined) {
      updateData.ctas = input.ctas;
    }

    const [updated] = await db
      .update(products)
      .set(updateData)
      .where(eq(products.id, input.id))
      .returning();

    if (!updated) {
      throw new Error("Failed to update product");
    }

    return {
      id: updated.id,
      type: updated.type,
      sourceUrl: updated.sourceUrl,
      title: updated.title,
      description: updated.description,
      price: updated.price ? parseFloat(updated.price) : null,
      images: updated.images,
      hooks: updated.hooks,
      ctas: updated.ctas,
      parsed: updated.parsed,
      error: updated.error,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  } catch (error) {
    console.error("Failed to update product:", error);
    throw error;
  }
}
