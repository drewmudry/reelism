"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProduct } from "@/actions/products";
import { Loader2 } from "lucide-react";

interface Product {
  id: string;
  type: "external" | "custom";
  sourceUrl: string | null;
  title: string | null;
  description: string | null;
  price: number | null;
  images: string[];
  parsed: boolean;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ProductEditFormProps {
  product: Product;
  onSave: (product: Product) => void;
  onCancel: () => void;
}

export function ProductEditForm({
  product,
  onSave,
  onCancel,
}: ProductEditFormProps) {
  const [title, setTitle] = useState(product.title || "");
  const [description, setDescription] = useState(product.description || "");
  const [price, setPrice] = useState(product.price?.toString() || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateProduct({
        id: product.id,
        title: title.trim(),
        description: description.trim() || undefined,
        price: price ? parseFloat(price) : undefined,
      });

      onSave(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update product");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="edit-title" className="text-sm font-medium">
          Title *
        </label>
        <Input
          id="edit-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isSaving}
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="edit-description" className="text-sm font-medium">
          Description
        </label>
        <textarea
          id="edit-description"
          className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isSaving}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="edit-price" className="text-sm font-medium">
          Price
        </label>
        <Input
          id="edit-price"
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          disabled={isSaving}
        />
      </div>

      {product.images && product.images.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Images</label>
          <div className="grid grid-cols-3 gap-2">
            {product.images.map((image, index) => (
              <div key={index} className="relative aspect-square rounded-md overflow-hidden border">
                <img
                  src={image}
                  alt={`Product image ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Image editing coming soon
          </p>
        </div>
      )}

      <div className="flex gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving} className="flex-1">
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </form>
  );
}
