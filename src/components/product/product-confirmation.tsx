"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getProductById, updateProduct } from "@/actions/products";
import { Loader2, Check } from "lucide-react";

interface ProductConfirmationProps {
  productId: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function ProductConfirmation({
  productId,
  onConfirm,
  onCancel,
}: ProductConfirmationProps) {
  const [product, setProduct] = useState<{
    id: string;
    title: string | null;
    description: string | null;
    price: number | null;
    images: string[];
    parsed: boolean;
    error: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  
  // Editable fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");

  // Poll for product updates if not parsed yet
  useEffect(() => {
    if (!product || product.parsed || product.error) {
      return;
    }

    setIsPolling(true);
    const interval = setInterval(async () => {
      try {
        const updated = await getProductById(productId);
        setProduct(updated);
        
        if (updated.parsed || updated.error) {
          setIsPolling(false);
          clearInterval(interval);
          
          // Update editable fields when product is parsed
          if (updated.parsed) {
            setTitle(updated.title || "");
            setDescription(updated.description || "");
            setPrice(updated.price?.toString() || "");
          }
        }
      } catch (error) {
        console.error("Failed to poll product:", error);
      }
    }, 2000); // Poll every 2 seconds

    return () => {
      clearInterval(interval);
      setIsPolling(false);
    };
  }, [product, productId]);

  // Load product on mount
  useEffect(() => {
    const loadProduct = async () => {
      try {
        const data = await getProductById(productId);
        setProduct(data);
        setTitle(data.title || "");
        setDescription(data.description || "");
        setPrice(data.price?.toString() || "");
      } catch (error) {
        console.error("Failed to load product:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProduct();
  }, [productId]);

  const handleSave = async () => {
    if (!product) return;

    setIsSaving(true);
    try {
      await updateProduct({
        id: product.id,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        price: price ? parseFloat(price) : undefined,
      });
      onConfirm();
    } catch (error) {
      console.error("Failed to update product:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Product not found
      </div>
    );
  }

  // Show parsing state
  if (!product.parsed && !product.error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-8 space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm text-muted-foreground">
            Parsing product...
          </span>
        </div>
        <p className="text-xs text-center text-muted-foreground">
          We're extracting product details from the URL. This may take a moment.
        </p>
      </div>
    );
  }

  // Show error state
  if (product.error) {
    return (
      <div className="space-y-4">
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
          <p className="text-sm text-destructive font-medium">Error parsing product</p>
          <p className="text-xs text-destructive/80 mt-1">{product.error}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button onClick={onConfirm} className="flex-1">
            Continue Anyway
          </Button>
        </div>
      </div>
    );
  }

  // Show confirmation/edit form
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Title *</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Product title"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Product description"
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Price</label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0.00"
        />
      </div>

      {product.images.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Images</label>
          <div className="grid grid-cols-3 gap-2">
            {product.images.map((img, index) => (
              <div key={index} className="relative aspect-square rounded-md overflow-hidden border">
                <img
                  src={img}
                  alt={`Product image ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-4">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={isSaving || !title.trim()}
          className="flex-1"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Confirm & Save
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
