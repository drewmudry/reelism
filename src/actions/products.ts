"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/index";
import { products } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { parseProductTask } from "@/trigger/parse-product";
import { getPresignedUploadUrl } from "@/lib/storage";

export interface CreateProductFromUrlInput {
  sourceUrl: string;
}

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
}

/**
 * Add a product via URL
 * Creates a product record with parsed=false and triggers a background job to parse it
 */
export async function createProductFromUrl(input: CreateProductFromUrlInput) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  try {
    // Validate URL
    let url: URL;
    try {
      url = new URL(input.sourceUrl);
    } catch {
      throw new Error("Invalid URL");
    }

    // Create product record with parsed=false
    const [product] = await db
      .insert(products)
      .values({
        userId: session.user.id,
        type: "external",
        sourceUrl: url.toString(),
        parsed: false,
        images: [],
      })
      .returning();

    if (!product) {
      throw new Error("Failed to create product record");
    }

    // Trigger background job to parse the product
    try {
      await parseProductTask.trigger({
        productId: product.id,
      });
    } catch (triggerError) {
      console.error("Failed to trigger parse product job:", triggerError);
      // Update product with error but don't fail the request
      await db
        .update(products)
        .set({
          error: "Failed to start parsing job",
          updatedAt: new Date(),
        })
        .where(eq(products.id, product.id));
    }

    return { productId: product.id };
  } catch (error) {
    console.error("Failed to create product from URL:", error);
    throw error;
  }
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
 * Update a product
 * Allows editing title, description, price, and images
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
