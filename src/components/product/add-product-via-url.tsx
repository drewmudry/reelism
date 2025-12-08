"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createProductFromUrl } from "@/actions/products";
import { Loader2 } from "lucide-react";

interface AddProductViaUrlProps {
  onProductCreated: (productId: string) => void;
  onError?: (error: string) => void;
}

export function AddProductViaUrl({
  onProductCreated,
  onError,
}: AddProductViaUrlProps) {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      onError?.("Please enter a URL");
      return;
    }

    setIsLoading(true);
    try {
      const result = await createProductFromUrl({ sourceUrl: url.trim() });
      onProductCreated(result.productId);
      setUrl(""); // Clear the input
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to add product";
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="product-url" className="text-sm font-medium">
          Product URL
        </label>
        <Input
          id="product-url"
          type="url"
          placeholder="https://example.com/product"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isLoading}
          required
        />
        <p className="text-xs text-muted-foreground">
          Paste a product URL and we'll extract the details automatically
        </p>
      </div>
      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Adding...
          </>
        ) : (
          "Add Product"
        )}
      </Button>
    </form>
  );
}
