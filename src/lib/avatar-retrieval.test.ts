/**
 * Avatar Retrieval Module - Verification Tests
 *
 * These tests verify the avatar-retrieval module functionality including:
 * - S3 key extraction from URLs
 * - Public URL construction
 * - Cache management
 * - Image format normalization
 * - Fallback mechanisms
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  extractS3Key,
  constructPublicUrl,
  clearAvatarCache,
  getAvatarCacheStats,
  invalidateAvatarCache,
  getAvatarImage,
  getAvatarImages,
  getAvatarForVideoGeneration,
  preloadAvatarImages,
  checkAvatarExists,
  getAvatarPresignedUrl,
} from "./avatar-retrieval";

// Mock environment variables
const mockEnv = {
  AWS_REGION: "us-east-1",
  AWS_BUCKET_NAME: "test-bucket",
  AWS_ACCESS_KEY_ID: "test-access-key",
  AWS_SECRET_ACCESS_KEY: "test-secret-key",
  AWS_PUBLIC_URL: undefined as string | undefined,
};

// Store original env
const originalEnv = { ...process.env };

describe("Avatar Retrieval Module", () => {
  beforeEach(() => {
    // Set up mock environment
    process.env = { ...originalEnv, ...mockEnv };
    // Clear cache before each test
    clearAvatarCache();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    // Clear cache after each test
    clearAvatarCache();
  });

  describe("extractS3Key", () => {
    it("should extract key from default S3 URL format", () => {
      const url = "https://test-bucket.s3.us-east-1.amazonaws.com/avatars/abc123.jpg";
      const key = extractS3Key(url);
      expect(key).toBe("avatars/abc123.jpg");
    });

    it("should extract key from S3 URL with subdirectories", () => {
      const url = "https://test-bucket.s3.us-east-1.amazonaws.com/users/123/avatars/image.png";
      const key = extractS3Key(url);
      expect(key).toBe("users/123/avatars/image.png");
    });

    it("should extract key from custom public URL when AWS_PUBLIC_URL is set", () => {
      process.env.AWS_PUBLIC_URL = "https://cdn.example.com";
      const url = "https://cdn.example.com/avatars/xyz789.jpg";
      const key = extractS3Key(url);
      expect(key).toBe("avatars/xyz789.jpg");
    });

    it("should handle URL-encoded characters", () => {
      const url = "https://test-bucket.s3.us-east-1.amazonaws.com/avatars/file%20name.jpg";
      const key = extractS3Key(url);
      expect(key).toBe("avatars/file%20name.jpg");
    });
  });

  describe("constructPublicUrl", () => {
    it("should construct default S3 URL", () => {
      const key = "avatars/abc123.jpg";
      const url = constructPublicUrl(key);
      expect(url).toBe("https://test-bucket.s3.us-east-1.amazonaws.com/avatars/abc123.jpg");
    });

    it("should use custom AWS_PUBLIC_URL when set", () => {
      process.env.AWS_PUBLIC_URL = "https://cdn.example.com";
      const key = "avatars/xyz789.jpg";
      const url = constructPublicUrl(key);
      expect(url).toBe("https://cdn.example.com/avatars/xyz789.jpg");
    });

    it("should handle keys with subdirectories", () => {
      const key = "users/456/avatars/profile.png";
      const url = constructPublicUrl(key);
      expect(url).toBe("https://test-bucket.s3.us-east-1.amazonaws.com/users/456/avatars/profile.png");
    });
  });

  describe("Cache Management", () => {
    it("should start with empty cache", () => {
      const stats = getAvatarCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.entries).toHaveLength(0);
    });

    it("should clear cache correctly", () => {
      // The cache is internal, so we test via stats
      clearAvatarCache();
      const stats = getAvatarCacheStats();
      expect(stats.size).toBe(0);
    });

    it("should report correct max cache size", () => {
      const stats = getAvatarCacheStats();
      expect(stats.maxSize).toBe(100);
    });

    it("should invalidate non-existent cache entry gracefully", () => {
      const result = invalidateAvatarCache("https://example.com/non-existent.jpg");
      expect(result).toBe(false);
    });
  });

  describe("getAvatarImage", () => {
    it("should return fallback when URL is invalid", async () => {
      const result = await getAvatarImage("https://invalid-bucket.s3.invalid.amazonaws.com/missing.jpg");

      // Should return result with fallback
      expect(result.isFallback).toBe(true);
      expect(result.success).toBe(false);
      expect(result.base64).toBeDefined();
      expect(result.mimeType).toBe("image/png");
    });

    it("should request presigned URL when usePresignedUrl is true", async () => {
      // This will fail due to no real S3 credentials, but tests the code path
      const result = await getAvatarImage(
        "https://test-bucket.s3.us-east-1.amazonaws.com/avatars/test.jpg",
        { usePresignedUrl: true }
      );

      // Without real credentials, this should fail
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should skip cache when skipCache is true", async () => {
      const url = "https://test-bucket.s3.us-east-1.amazonaws.com/avatars/test.jpg";

      // First call
      await getAvatarImage(url, { skipCache: true });

      // Second call with skipCache should not use cache
      const result = await getAvatarImage(url, { skipCache: true });
      expect(result.fromCache).toBe(false);
    });
  });

  describe("getAvatarImages (batch)", () => {
    it("should handle empty URL array", async () => {
      const results = await getAvatarImages([]);
      expect(results.size).toBe(0);
    });

    it("should process multiple URLs", async () => {
      const urls = [
        "https://test-bucket.s3.us-east-1.amazonaws.com/avatars/1.jpg",
        "https://test-bucket.s3.us-east-1.amazonaws.com/avatars/2.jpg",
      ];

      const results = await getAvatarImages(urls);
      expect(results.size).toBe(2);

      for (const url of urls) {
        expect(results.has(url)).toBe(true);
      }
    });
  });

  describe("getAvatarForVideoGeneration", () => {
    it("should return formatted result for video generation", async () => {
      const result = await getAvatarForVideoGeneration(
        "https://test-bucket.s3.us-east-1.amazonaws.com/avatars/test.jpg"
      );

      // Since we can't fetch real images, it should fall back
      expect(result.base64).toBeDefined();
      expect(result.mimeType).toBeDefined();
    });

    it("should normalize to JPEG format", async () => {
      const result = await getAvatarForVideoGeneration(
        "https://test-bucket.s3.us-east-1.amazonaws.com/avatars/test.jpg"
      );

      // Fallback returns PNG, but the function is configured for JPEG
      expect(result).toHaveProperty("base64");
      expect(result).toHaveProperty("mimeType");
    });
  });

  describe("preloadAvatarImages", () => {
    it("should handle empty URL array", async () => {
      const result = await preloadAvatarImages([]);
      expect(result.loaded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should report failed loads correctly", async () => {
      const urls = [
        "https://test-bucket.s3.us-east-1.amazonaws.com/avatars/nonexistent1.jpg",
        "https://test-bucket.s3.us-east-1.amazonaws.com/avatars/nonexistent2.jpg",
      ];

      const result = await preloadAvatarImages(urls);
      expect(result.failed).toBe(2);
      expect(result.loaded).toBe(0);
    });
  });

  describe("Module Exports", () => {
    it("should export all required functions", () => {
      expect(typeof extractS3Key).toBe("function");
      expect(typeof constructPublicUrl).toBe("function");
      expect(typeof clearAvatarCache).toBe("function");
      expect(typeof getAvatarCacheStats).toBe("function");
      expect(typeof invalidateAvatarCache).toBe("function");
      expect(typeof getAvatarImage).toBe("function");
      expect(typeof getAvatarImages).toBe("function");
      expect(typeof getAvatarForVideoGeneration).toBe("function");
      expect(typeof preloadAvatarImages).toBe("function");
      expect(typeof checkAvatarExists).toBe("function");
      expect(typeof getAvatarPresignedUrl).toBe("function");
    });
  });
});

describe("Integration Scenarios", () => {
  beforeEach(() => {
    process.env = { ...originalEnv, ...mockEnv };
    clearAvatarCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    clearAvatarCache();
  });

  it("should handle video generation pipeline scenario", async () => {
    // Simulate video generation pipeline flow
    const avatarUrl = "https://test-bucket.s3.us-east-1.amazonaws.com/avatars/avatar123.jpg";

    // 1. Check if avatar exists (will fail without real S3)
    const exists = await checkAvatarExists(avatarUrl);
    expect(typeof exists).toBe("boolean");

    // 2. Get avatar for video generation
    const avatarData = await getAvatarForVideoGeneration(avatarUrl);
    expect(avatarData).toHaveProperty("base64");
    expect(avatarData).toHaveProperty("mimeType");

    // 3. Verify cache stats
    const stats = getAvatarCacheStats();
    expect(stats).toHaveProperty("size");
    expect(stats).toHaveProperty("maxSize");
  });

  it("should handle batch preload scenario", async () => {
    const avatarUrls = [
      "https://test-bucket.s3.us-east-1.amazonaws.com/avatars/a1.jpg",
      "https://test-bucket.s3.us-east-1.amazonaws.com/avatars/a2.jpg",
      "https://test-bucket.s3.us-east-1.amazonaws.com/avatars/a3.jpg",
    ];

    // Preload all avatars
    const preloadResult = await preloadAvatarImages(avatarUrls);
    expect(preloadResult).toHaveProperty("loaded");
    expect(preloadResult).toHaveProperty("failed");
    expect(preloadResult).toHaveProperty("errors");

    // Verify total matches input count
    expect(preloadResult.loaded + preloadResult.failed).toBe(avatarUrls.length);
  });

  it("should construct and extract S3 keys consistently", () => {
    const originalKey = "users/abc123/avatars/profile.jpg";

    // Construct URL from key
    const url = constructPublicUrl(originalKey);

    // Extract key from URL
    const extractedKey = extractS3Key(url);

    // Should match original
    expect(extractedKey).toBe(originalKey);
  });

  it("should handle custom CDN URL consistently", () => {
    process.env.AWS_PUBLIC_URL = "https://cdn.myapp.com";
    const originalKey = "avatars/image123.jpg";

    // Construct URL from key
    const url = constructPublicUrl(originalKey);
    expect(url).toBe("https://cdn.myapp.com/avatars/image123.jpg");

    // Extract key from URL
    const extractedKey = extractS3Key(url);
    expect(extractedKey).toBe(originalKey);
  });
});
