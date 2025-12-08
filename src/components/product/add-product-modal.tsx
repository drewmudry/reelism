"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddProductViaUrl } from "./add-product-via-url";
import { AddProductManually } from "./add-product-manually";
import { ProductConfirmation } from "./product-confirmation";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface AddProductModalProps {
  onProductAdded?: () => void;
}

export function AddProductModal({ onProductAdded }: AddProductModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"url" | "manual">("url");
  const [currentProductId, setCurrentProductId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleProductCreated = (productId: string) => {
    setCurrentProductId(productId);
    setError(null);
  };

  const handleConfirm = () => {
    setCurrentProductId(null);
    setIsOpen(false);
    // Dispatch event to refresh product list
    window.dispatchEvent(new CustomEvent("productAdded"));
    router.refresh();
    onProductAdded?.();
  };

  const handleCancel = () => {
    setCurrentProductId(null);
    setError(null);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Add Product
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
            <DialogDescription>
              Add a product by URL or manually upload details
            </DialogDescription>
          </DialogHeader>

          {currentProductId ? (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Product Detected! Please confirm 👇</h3>
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
              <ProductConfirmation
                productId={currentProductId}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
              />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "url" | "manual")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url">Via URL</TabsTrigger>
                <TabsTrigger value="manual">Manual</TabsTrigger>
              </TabsList>
              
              {error && (
                <div className="mt-4 bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <TabsContent value="url" className="mt-4">
                <AddProductViaUrl
                  onProductCreated={handleProductCreated}
                  onError={handleError}
                />
              </TabsContent>

              <TabsContent value="manual" className="mt-4">
                <AddProductManually
                  onProductCreated={handleProductCreated}
                  onError={handleError}
                />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
