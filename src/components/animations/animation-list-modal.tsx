"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MediaModal } from "@/components/ui/media-modal";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Copy, Check, Sparkles, Loader2 } from "lucide-react";
import { generateAnimationFromVideo } from "@/actions/generate-animation-from-video";

interface Animation {
  id: string;
  videoUrl: string | null;
  prompt: string;
  avatarId: string;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
  avatar: {
    id: string;
    imageUrl: string | null;
    prompt: any;
  } | null;
}

interface AnimationListModalProps {
  animation: Animation;
  onClose: () => void;
}

export function AnimationListModal({ animation, onClose }: AnimationListModalProps) {
  const router = useRouter();
  const [showBaseImage, setShowBaseImage] = useState(false);
  const [hasCopiedPrompt, setHasCopiedPrompt] = useState(false);
  const [isRemixing, setIsRemixing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  // Product selection state
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedProductImageUrls, setSelectedProductImageUrls] = useState<string[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // Fetch products when opening remix panel
  const fetchProducts = async () => {
    if (products.length > 0) return;

    setIsLoadingProducts(true);
    try {
      const { getProducts } = await import("@/actions/products");
      const userProducts = await getProducts();
      setProducts(userProducts);
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const handleRemixClick = () => {
    if (!isRemixing) {
      fetchProducts();
      setCustomPrompt(animation.prompt); // Initialize with original prompt
    } else {
      setCustomPrompt(""); // Reset when closing
    }
    setIsRemixing(!isRemixing);
  };

  const handleRemixSubmit = async () => {
    if (selectedProductImageUrls.length === 0) {
      alert("Please select at least one product image");
      return;
    }

    if (!customPrompt.trim()) {
      alert("Please enter a prompt describing the animation");
      return;
    }

    setIsGenerating(true);
    try {
      // Limit to max 2 product images (avatar takes 1 slot, max 3 total)
      const productImageUrls = selectedProductImageUrls.slice(0, 2);
      await generateAnimationFromVideo(animation.id, productImageUrls, customPrompt.trim());
      // Close modal and refresh
      setIsRemixing(false);
      setSelectedProductId("");
      setSelectedProductImageUrls([]);
      setCustomPrompt("");
      onClose();
      router.refresh();
    } catch (error) {
      console.error("Failed to generate animation with products:", error);
      alert("Failed to generate animation. Please try again.");
      setIsGenerating(false);
    }
  };

  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    setSelectedProductImageUrls([]);
  };

  const handleImageToggle = (imageUrl: string) => {
    setSelectedProductImageUrls(prev => {
      if (prev.includes(imageUrl)) {
        return prev.filter(url => url !== imageUrl);
      } else {
        // Max 2 product images (avatar takes 1 slot, max 3 total)
        if (prev.length >= 2) {
          return prev;
        }
        return [...prev, imageUrl];
      }
    });
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const productImages = selectedProduct?.images || [];

  const handleCopyPrompt = () => {
    if (!animation.prompt) return;
    navigator.clipboard.writeText(animation.prompt);
    setHasCopiedPrompt(true);
    setTimeout(() => setHasCopiedPrompt(false), 2000);
  };

  const handleToggleBaseImage = () => {
    setShowBaseImage(!showBaseImage);
  };

  // Determine which media to show
  const currentMediaType = showBaseImage ? "image" : "video";
  const currentMediaUrl = showBaseImage
    ? animation.avatar?.imageUrl ?? null
    : animation.videoUrl;

  const productSelector = (
    <div className="mb-4">
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
        Attach Products (Optional)
      </label>
      <select
        value={selectedProductId}
        onChange={(e) => handleProductSelect(e.target.value)}
        disabled={isGenerating || isLoadingProducts}
        className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400 appearance-none"
      >
        <option value="">Select a product...</option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.title}
          </option>
        ))}
      </select>
      {selectedProductId && (
        <div className="mt-3">
          <div className="text-xs text-zinc-500 flex items-center gap-2 mb-2">
            <span>Selected: {selectedProduct?.title}</span>
            <button
              onClick={() => {
                setSelectedProductId("");
                setSelectedProductImageUrls([]);
              }}
              className="text-red-500 hover:text-red-600"
            >
              Remove
            </button>
          </div>
          {productImages.length > 0 && (
            <div className="mt-2">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                Select images to use ({selectedProductImageUrls.length}/2 selected)
              </label>
              {selectedProductImageUrls.length >= 2 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                  Maximum 2 product images can be used (avatar takes 1 slot, max 3 total).
                </p>
              )}
              <div className="grid grid-cols-3 gap-2">
                {productImages.map((imageUrl: string, index: number) => {
                  const isSelected = selectedProductImageUrls.includes(imageUrl);
                  const isDisabled = !isSelected && selectedProductImageUrls.length >= 2;
                  return (
                    <div
                      key={index}
                      onClick={() => !isDisabled && handleImageToggle(imageUrl)}
                      className={`relative rounded-md overflow-hidden border-2 transition-all ${
                        isSelected
                          ? "border-blue-500 ring-2 ring-blue-500/20 cursor-pointer"
                          : isDisabled
                            ? "border-zinc-200 dark:border-zinc-800 cursor-not-allowed opacity-50"
                            : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer"
                      }`}
                    >
                      <img
                        src={imageUrl}
                        alt={`Product image ${index + 1}`}
                        className="w-full h-20 object-cover"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                          <div className="bg-blue-500 rounded-full p-1">
                            <svg
                              className="w-4 h-4 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const sidePanel = (
    <>
      {isRemixing && (
        <div className="w-[400px] mr-4 bg-card rounded-lg shadow-2xl border border-zinc-200 dark:border-zinc-800 p-4 overflow-y-auto max-h-[576px] animate-in slide-in-from-left-1/2 flex flex-col">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <Sparkles className="h-4 w-4 text-blue-500" />
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Add Products to Animation</h3>
          </div>

          <div className="flex-1 flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Animation Prompt
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g., A gentle swaying motion, walking forward, waving hello..."
                className="w-full min-h-[80px] px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400 resize-none"
                disabled={isGenerating}
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 mb-4">
                Describe how you want to animate the avatar with the selected products.
              </p>
            </div>

            <div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-4">
                Select product images to add to this animation. A new video will be generated with the same motion but including the selected products.
              </p>
              <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-2 mb-4">
                <strong>Note:</strong> The new video will be generated in 16:9 aspect ratio (instead of 9:16) due to Veo API limitations when using products.
              </div>
            </div>

            {productSelector}
          </div>

          <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              onClick={handleRemixSubmit}
              disabled={isGenerating || selectedProductImageUrls.length === 0 || !customPrompt.trim()}
              className="w-full gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate with Products
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  );

  const controlButtons = (
    <>
      {/* Base Image Button */}
      {animation.avatar?.imageUrl && (
        <button
          onClick={handleToggleBaseImage}
          className={`h-10 rounded-full transition-all shadow-lg font-semibold flex items-center justify-center gap-2 px-3 border ${showBaseImage
              ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
              : "bg-card text-foreground hover:bg-muted border-zinc-200 dark:border-zinc-800"
            }`}
          aria-label="Toggle base image"
          title="View base avatar image"
        >
          <ImageIcon size={18} />
          <span className="text-xs hidden sm:inline">
            {showBaseImage ? "Video" : "Base Image"}
          </span>
        </button>
      )}

      {/* Add Products Button */}
      {animation.videoUrl && (
        <button
          onClick={handleRemixClick}
          className={`h-10 rounded-full transition-all shadow-lg font-semibold flex items-center justify-center gap-2 px-3 border ${isRemixing
              ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
              : "bg-card text-foreground hover:bg-muted border-zinc-200 dark:border-zinc-800"
            }`}
          aria-label="Add products"
          title="Add products to this animation"
        >
          <Sparkles size={18} />
          <span className="text-xs hidden sm:inline">
            {isRemixing ? "Done" : "Add Products"}
          </span>
        </button>
      )}

      {/* Copy Motion Prompt Button */}
      <button
        onClick={handleCopyPrompt}
        className="h-10 rounded-full transition-all shadow-lg font-semibold flex items-center justify-center gap-2 px-3 border bg-card text-foreground hover:bg-muted border-zinc-200 dark:border-zinc-800"
        aria-label="Copy motion prompt"
        title="Copy animation prompt"
      >
        {hasCopiedPrompt ? (
          <Check size={18} className="text-green-500" />
        ) : (
          <Copy size={18} />
        )}
        <span className="text-xs hidden sm:inline">
          {hasCopiedPrompt ? "Copied!" : "Copy Prompt"}
        </span>
      </button>
    </>
  );

  return (
    <MediaModal
      mediaType={currentMediaType}
      mediaUrl={currentMediaUrl}
      isLoading={!animation.videoUrl}
      loadingText="Generating animation..."
      loadingSubtext="This may take a few minutes"
      onClose={onClose}
      showCopyButtons={false}
      showDownloadButton={!showBaseImage}
      controlButtons={controlButtons}
      sidePanel={sidePanel}
      isPanelOpen={isRemixing}
    />
  );
}
