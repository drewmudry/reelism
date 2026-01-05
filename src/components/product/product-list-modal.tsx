"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Edit, ChevronLeft, ChevronRight, Plus, Loader2, Video, Sparkles } from "lucide-react";
import { ProductEditForm } from "./product-edit-form";
import { ProductHooksEditor } from "./product-hooks-editor";
import { updateProduct, getPresignedUrls } from "@/actions/products";
import { useRouter } from "next/navigation";

interface Product {
  id: string;
  type: "external" | "custom";
  sourceUrl: string | null;
  title: string | null;
  description: string | null;
  price: number | null;
  images: string[];
  hooks?: string[];
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
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingHooks, setIsEditingHooks] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAddingImages, setIsAddingImages] = useState(false);
  const [uploadingImages, setUploadingImages] = useState<string[]>([]);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const images = product.images || [];
  const hasMultipleImages = images.length > 1;

  // Reset image index when product changes
  useEffect(() => {
    setCurrentImageIndex(0);
    setImageAspectRatio(null);
  }, [product.id]);

  // Update aspect ratio when image loads or changes
  const handleImageLoad = () => {
    if (imageRef.current) {
      const { naturalWidth, naturalHeight } = imageRef.current;
      if (naturalWidth > 0 && naturalHeight > 0) {
        setImageAspectRatio(naturalWidth / naturalHeight);
      }
    }
  };

  // Reset aspect ratio when image index changes to recalculate
  useEffect(() => {
    setImageAspectRatio(null);
    // Check if image is already loaded (cached images) after a brief delay
    const timer = setTimeout(() => {
      if (imageRef.current?.complete && imageRef.current.naturalWidth > 0) {
        handleImageLoad();
      }
    }, 10);
    return () => clearTimeout(timer);
  }, [currentImageIndex]);

  const handlePreviousImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleEditClick = () => {
    setIsAddingImages(false);
    setIsEditingHooks(false);
    setIsEditing(!isEditing);
  };

  const handleAddImagesClick = () => {
    setIsEditing(false);
    setIsEditingHooks(false);
    if (!isAddingImages) {
      setIsAddingImages(true);
      // Trigger file picker after a short delay to ensure panel is open
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 100);
    } else {
      setIsAddingImages(false);
    }
  };

  const handleEditHooksClick = () => {
    setIsEditing(false);
    setIsAddingImages(false);
    setIsEditingHooks(!isEditingHooks);
  };

  const handleViewDemos = () => {
    onClose();
    router.push(`/app/demos?productId=${product.id}`);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) return;

    // Filter valid image files
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    setUploadingImages(imageFiles.map(f => f.name));

    try {
      // Get presigned URLs from server
      const presignedData = await getPresignedUrls(
        imageFiles.map((file) => ({
          filename: file.name,
          contentType: file.type,
        }))
      );

      // Upload each image directly to S3
      const uploadPromises = imageFiles.map(async (file, index) => {
        const { uploadUrl, publicUrl } = presignedData[index];
        
        try {
          // Upload to S3 using presigned URL
          const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: {
              "Content-Type": file.type,
            },
          });

          if (!uploadResponse.ok) {
            throw new Error(`Failed to upload ${file.name}`);
          }

          return publicUrl;
        } catch (error) {
          console.error(`Upload error for ${file.name}:`, error);
          throw error;
        }
      });

      const uploadedUrls = await Promise.all(uploadPromises);

      // Update product with new images
      const updated = await updateProduct({
        id: product.id,
        images: [...images, ...uploadedUrls],
      });

      onProductUpdated(updated);
      setUploadingImages([]);
      setIsAddingImages(false);
    } catch (error) {
      console.error("Failed to upload images:", error);
      alert(error instanceof Error ? error.message : "Failed to upload images");
      setUploadingImages([]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const sidePanel = (
    <>
      {/* Edit Panel */}
      {isEditing && (
        <div className="w-[400px] mr-4 bg-card rounded-lg shadow-2xl border border-zinc-200 dark:border-zinc-800 p-4 overflow-y-auto max-h-[576px] animate-in slide-in-from-left-1/2">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <Edit className="h-4 w-4 text-blue-500" />
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Edit Product</h3>
          </div>
          <ProductEditForm
            product={product}
            onSave={(updatedProduct) => {
              onProductUpdated(updatedProduct);
              setIsEditing(false);
            }}
            onCancel={() => setIsEditing(false)}
          />
        </div>
      )}

      {/* Add Images Panel */}
      {isAddingImages && (
        <div className="w-[400px] mr-4 bg-card rounded-lg shadow-2xl border border-zinc-200 dark:border-zinc-800 p-4 overflow-y-auto max-h-[576px] animate-in slide-in-from-left-1/2">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <Plus className="h-4 w-4 text-blue-500" />
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Add Images</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-4">
                Select images to add to this product. They will be uploaded and added to the existing images.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImages.length > 0}
                className="w-full gap-2"
                variant="outline"
              >
                {uploadingImages.length > 0 ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading {uploadingImages.length} image{uploadingImages.length > 1 ? "s" : ""}...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Select Images to Upload
                  </>
                )}
              </Button>
            </div>
            {images.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Current Images ({images.length})</h4>
                <div className="grid grid-cols-3 gap-2">
                  {images.map((image, index) => (
                    <div key={index} className="relative aspect-square rounded-md overflow-hidden border">
                      <img
                        src={image}
                        alt={`Product image ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Hooks Panel */}
      {isEditingHooks && (
        <div className="w-[400px] mr-4 bg-card rounded-lg shadow-2xl border border-zinc-200 dark:border-zinc-800 p-4 overflow-y-auto max-h-[576px] animate-in slide-in-from-left-1/2">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <Sparkles className="h-4 w-4 text-blue-500" />
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Edit Hooks</h3>
          </div>
          <ProductHooksEditor
            productId={product.id}
            productTitle={product.title || ""}
            productDescription={product.description || undefined}
            initialHooks={product.hooks || []}
            onSave={(updatedProduct) => {
              onProductUpdated(updatedProduct);
              setIsEditingHooks(false);
            }}
            onCancel={() => setIsEditingHooks(false)}
          />
        </div>
      )}
    </>
  );

  const controlButtons = (
    <>
      <button
        onClick={handleEditClick}
        className={`h-10 rounded-full transition-all shadow-lg font-semibold flex items-center justify-center gap-2 px-3 border ${
          isEditing
            ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
            : "bg-card text-foreground hover:bg-muted border-zinc-200 dark:border-zinc-800"
        }`}
        aria-label="Edit product"
        title="Edit product"
      >
        <Edit size={18} />
        <span className="text-xs hidden sm:inline">{isEditing ? "Done" : "Edit"}</span>
      </button>

      <button
        onClick={handleAddImagesClick}
        disabled={uploadingImages.length > 0}
        className={`h-10 rounded-full transition-all shadow-lg font-semibold flex items-center justify-center gap-2 px-3 border ${
          isAddingImages
            ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
            : "bg-card text-foreground hover:bg-muted border-zinc-200 dark:border-zinc-800"
        }`}
        aria-label="Add images"
        title="Add images"
      >
        {uploadingImages.length > 0 ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Plus size={18} />
        )}
        <span className="text-xs hidden sm:inline">{isAddingImages ? "Done" : "Add"}</span>
      </button>

      <button
        onClick={handleEditHooksClick}
        className={`h-10 rounded-full transition-all shadow-lg font-semibold flex items-center justify-center gap-2 px-3 border ${
          isEditingHooks
            ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
            : "bg-card text-foreground hover:bg-muted border-zinc-200 dark:border-zinc-800"
        }`}
        aria-label="Edit hooks"
        title="Edit hooks for this product"
      >
        <Sparkles size={18} />
        <span className="text-xs hidden sm:inline">{isEditingHooks ? "Done" : "Hooks"}</span>
      </button>

      <button
        onClick={handleViewDemos}
        className="h-10 rounded-full transition-all shadow-lg font-semibold flex items-center justify-center gap-2 px-3 border bg-card text-foreground hover:bg-muted border-zinc-200 dark:border-zinc-800"
        aria-label="View demos"
        title="View demos for this product"
      >
        <Video size={18} />
        <span className="text-xs hidden sm:inline">Demos</span>
      </button>
    </>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
        <div
          className={`pointer-events-auto transition-all duration-500 ease-out w-full ${
            isEditing || isAddingImages || isEditingHooks ? "max-w-[900px]" : "max-w-[420px]"
          }`}
        >
          <div className="flex gap-4">
            {/* Main Modal */}
            <div className="flex-shrink-0">
              <div 
                className="bg-card rounded-lg overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 w-96 relative max-h-[90vh]"
                style={{
                  height: imageAspectRatio 
                    ? `${384 / imageAspectRatio}px`
                    : '512px',
                }}
              >
                {images.length > 0 ? (
                  <>
                    {!imageAspectRatio && (
                      <div className="absolute inset-0 flex items-center justify-center bg-muted">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
                      </div>
                    )}
                    <img
                      key={images[currentImageIndex]}
                      ref={imageRef}
                      src={images[currentImageIndex]}
                      alt={product.title || "Product"}
                      onLoad={handleImageLoad}
                      className={`w-full h-full object-contain ${!imageAspectRatio ? 'opacity-0' : 'opacity-100'} transition-opacity`}
                    />
                    
                    {/* Left Arrow Button */}
                    {hasMultipleImages && (
                      <button
                        onClick={handlePreviousImage}
                        className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center bg-card hover:bg-muted rounded-full text-foreground transition-colors shadow-lg border border-zinc-200 dark:border-zinc-800 z-10"
                        aria-label="Previous image"
                      >
                        <ChevronLeft size={20} />
                      </button>
                    )}

                    {/* Right Arrow Button */}
                    {hasMultipleImages && (
                      <button
                        onClick={handleNextImage}
                        className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center bg-card hover:bg-muted rounded-full text-foreground transition-colors shadow-lg border border-zinc-200 dark:border-zinc-800 z-10"
                        aria-label="Next image"
                      >
                        <ChevronRight size={20} />
                      </button>
                    )}

                    {/* Image Counter */}
                    {hasMultipleImages && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 rounded-full text-white text-xs">
                        {currentImageIndex + 1} / {images.length}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted" style={{ minHeight: '512px' }}>
                    <p className="text-muted-foreground">No image</p>
                  </div>
                )}
              </div>
            </div>

            {/* Side Panel */}
            {sidePanel}

            {/* Control Buttons */}
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button
                onClick={onClose}
                className="h-10 w-10 flex items-center justify-center bg-card hover:bg-muted rounded-full text-foreground transition-colors shadow-lg border border-zinc-200 dark:border-zinc-800"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>

              {/* Additional Control Buttons */}
              {controlButtons}
            </div>
          </div>
        </div>
      </div>

    </>
  );
}
