"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Edit } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ProductEditForm } from "./product-edit-form";

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

interface ProductListModalProps {
  product: Product;
  onClose: () => void;
  onProductUpdated: (product: Product) => void;
}

export function ProductListModal({
  product,
  onClose,
  onProductUpdated,
}: ProductListModalProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="relative pointer-events-auto w-full max-w-2xl mx-4">
          <div className="bg-card rounded-lg overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800">
            {/* Header */}
            <div className="relative">
              {product.images && product.images.length > 0 ? (
                <img
                  src={product.images[0]}
                  alt={product.title || "Product"}
                  className="w-full h-64 object-cover"
                />
              ) : (
                <div className="w-full h-64 bg-muted flex items-center justify-center">
                  <p className="text-muted-foreground">No image</p>
                </div>
              )}

              {/* Close and Edit buttons */}
              <div className="absolute top-4 right-4 flex gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="h-10 w-10 flex items-center justify-center bg-card hover:bg-muted rounded-full text-foreground transition-colors shadow-lg border border-zinc-200 dark:border-zinc-800"
                  aria-label="Edit product"
                >
                  <Edit size={18} />
                </button>
                <button
                  onClick={onClose}
                  className="h-10 w-10 flex items-center justify-center bg-card hover:bg-muted rounded-full text-foreground transition-colors shadow-lg border border-zinc-200 dark:border-zinc-800"
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div>
                <h2 className="text-2xl font-bold mb-2">
                  {product.title || "Untitled Product"}
                </h2>
                {product.description && (
                  <p className="text-muted-foreground">{product.description}</p>
                )}
              </div>

              <div className="flex items-center gap-4">
                {product.price !== null && (
                  <div>
                    <span className="text-sm text-muted-foreground">Price: </span>
                    <span className="text-lg font-semibold">
                      ${product.price.toFixed(2)}
                    </span>
                  </div>
                )}
                <span
                  className={`px-3 py-1 rounded text-sm ${
                    product.type === "external"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  }`}
                >
                  {product.type === "external" ? "External" : "Custom"}
                </span>
              </div>

              {product.images && product.images.length > 1 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Additional Images</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {product.images.slice(1).map((image, index) => (
                      <img
                        key={index}
                        src={image}
                        alt={`Product image ${index + 2}`}
                        className="w-full h-24 object-cover rounded-md"
                      />
                    ))}
                  </div>
                </div>
              )}

              {product.sourceUrl && (
                <div>
                  <a
                    href={product.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View Source →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Sheet */}
      <Sheet open={isEditing} onOpenChange={setIsEditing}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Edit Product</SheetTitle>
            <SheetDescription>
              Update product details. Changes will be saved immediately.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <ProductEditForm
              product={product}
              onSave={(updatedProduct) => {
                onProductUpdated(updatedProduct);
                setIsEditing(false);
              }}
              onCancel={() => setIsEditing(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
