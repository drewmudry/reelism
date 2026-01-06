"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AddProductManually } from "./add-product-manually";
import { ProductHooksStep } from "./product-hooks-step";
import { ProductCTAsStep } from "./product-ctas-step";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

interface AddProductModalProps {
  onProductAdded?: () => void;
}

type ModalStep = "details" | "hooks" | "ctas";

interface ProductData {
  productId: string;
  title: string;
  description?: string;
}

export function AddProductModal({ onProductAdded }: AddProductModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<ModalStep>("details");
  const [productData, setProductData] = useState<ProductData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleProductCreated = (productId: string, title: string, description?: string) => {
    setProductData({ productId, title, description });
    setCurrentStep("hooks");
    setError(null);
  };

  const handleHooksComplete = () => {
    // Move to CTAs step
    setCurrentStep("ctas");
  };

  const handleCTAsComplete = () => {
    // Reset state and close modal
    setProductData(null);
    setCurrentStep("details");
    setIsOpen(false);
    // Dispatch event to refresh product list
    window.dispatchEvent(new CustomEvent("productAdded"));
    router.refresh();
    onProductAdded?.();
  };

  const handleBack = () => {
    if (currentStep === "ctas") {
      // Go back to hooks step
      setCurrentStep("hooks");
    } else if (currentStep === "hooks") {
      // Go back to details step
      setCurrentStep("details");
      setProductData(null);
    }
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset state when closing
      setProductData(null);
      setCurrentStep("details");
      setError(null);
    }
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

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {currentStep === "details"
                ? "Add Product"
                : currentStep === "hooks"
                ? "Add Hooks"
                : "Add CTAs"}
            </DialogTitle>
            <DialogDescription>
              {currentStep === "details"
                ? "Add your product details"
                : currentStep === "hooks"
                ? "Add attention-grabbing hooks for TikTok Shop videos"
                : "Add compelling call-to-action phrases for TikTok Shop videos"}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {currentStep === "details" ? (
            <AddProductManually
              onProductCreated={handleProductCreated}
              onError={handleError}
            />
          ) : currentStep === "hooks" && productData ? (
            <ProductHooksStep
              productId={productData.productId}
              productTitle={productData.title}
              productDescription={productData.description}
              onComplete={handleHooksComplete}
              onBack={handleBack}
            />
          ) : currentStep === "ctas" && productData ? (
            <ProductCTAsStep
              productId={productData.productId}
              productTitle={productData.title}
              productDescription={productData.description}
              onComplete={handleCTAsComplete}
              onBack={handleBack}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
