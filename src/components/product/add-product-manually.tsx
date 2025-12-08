"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createProductManually, getPresignedUrls } from "@/actions/products";
import { Loader2, Upload, X } from "lucide-react";

interface AddProductManuallyProps {
  onProductCreated: (productId: string) => void;
  onError?: (error: string) => void;
}

interface ImagePreview {
  file: File;
  preview: string;
  publicUrl: string | null; // Will be set after upload
  isUploading: boolean;
}

export function AddProductManually({
  onProductCreated,
  onError,
}: AddProductManuallyProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) return;

    // Filter valid image files
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length !== files.length) {
      onError?.("Please select only image files");
    }
    if (imageFiles.length === 0) return;

    // Create preview entries first
    const newImages: ImagePreview[] = imageFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      publicUrl: null,
      isUploading: true,
    }));

    setImages((prev) => [...prev, ...newImages]);

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
            const errorText = await uploadResponse.text().catch(() => "Unknown error");
            throw new Error(`Failed to upload ${file.name}: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`);
          }

          return publicUrl;
        } catch (error) {
          // Enhanced error logging
          console.error(`Upload error for ${file.name}:`, error);
          if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
            throw new Error(`CORS error: Your S3 bucket needs CORS configuration. See console for details.`);
          }
          throw error;
        }
      });

      const uploadedUrls = await Promise.all(uploadPromises);

      // Update images with public URLs
      setImages((prev) => {
        const updated = [...prev];
        let urlIndex = 0;
        return updated.map((img) => {
          if (img.isUploading && img.publicUrl === null) {
            return {
              ...img,
              publicUrl: uploadedUrls[urlIndex++],
              isUploading: false,
            };
          }
          return img;
        });
      });
    } catch (error) {
      console.error("Failed to upload images:", error);
      // Remove failed uploads
      setImages((prev) => prev.filter((img) => !img.isUploading || img.publicUrl !== null));
      onError?.(error instanceof Error ? error.message : "Failed to upload images");
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      onError?.("Title is required");
      return;
    }

    // Check that all images have been uploaded
    const uploadedImages = images.filter((img) => img.publicUrl !== null && !img.isUploading);
    if (uploadedImages.length === 0) {
      onError?.("Please wait for images to finish uploading");
      return;
    }

    if (images.some((img) => img.isUploading)) {
      onError?.("Please wait for all images to finish uploading");
      return;
    }

    setIsLoading(true);
    try {
      const imageUrls = uploadedImages.map((img) => img.publicUrl!);
      
      const result = await createProductManually({
        title: title.trim(),
        description: description.trim() || undefined,
        price: price ? parseFloat(price) : undefined,
        imageUrls,
      });
      onProductCreated(result.productId);
      
      // Reset form
      setTitle("");
      setDescription("");
      setPrice("");
      images.forEach((img) => URL.revokeObjectURL(img.preview));
      setImages([]);
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
        <label htmlFor="product-title" className="text-sm font-medium">
          Title *
        </label>
        <Input
          id="product-title"
          type="text"
          placeholder="Product name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isLoading}
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="product-description" className="text-sm font-medium">
          Description
        </label>
        <textarea
          id="product-description"
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Product description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="product-price" className="text-sm font-medium">
          Price
        </label>
        <Input
          id="product-price"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Images *</label>
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            disabled={isLoading}
            className="hidden"
            id="product-images"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="w-full"
          >
            <Upload className="h-4 w-4" />
            Upload Images
          </Button>
          
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((img, index) => (
                <div key={index} className="relative group">
                  <img
                    src={img.preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-24 object-cover rounded-md"
                  />
                  {img.isUploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-md flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={isLoading || img.isUploading}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
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
