"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, ChevronRight, ChevronLeft, X } from "lucide-react";
import { getDemoUploadPresignedUrl, createDemoRecord } from "@/actions/demos";
import { getProducts } from "@/actions/products";
import FileUpload from "@/components/kokonutui/file-upload";
import { VideoRegionSelector, TalkingHeadRegion } from "@/components/demos/video-region-selector";

type Product = {
  id: string;
  title: string | null;
};

export function DemoModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [videoWidth, setVideoWidth] = useState<number | null>(null);
  const [videoHeight, setVideoHeight] = useState<number | null>(null);
  const [isVertical, setIsVertical] = useState<boolean | null>(null);
  const [talkingHeadRegions, setTalkingHeadRegions] = useState<TalkingHeadRegion[]>([]);
  const [regionsSidePanel, setRegionsSidePanel] = useState<React.ReactNode>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setFile(null);
      setTitle("");
      setUploadedUrl(null);
      setVideoWidth(null);
      setVideoHeight(null);
      setIsVertical(null);
      setTalkingHeadRegions([]);
      setRegionsSidePanel(null);
      setSelectedProductId("");
    }
  }, [open]);

  // Detect video dimensions when URL is set
  useEffect(() => {
    if (uploadedUrl && videoRef.current) {
      const video = videoRef.current;
      const handleLoadedMetadata = () => {
        const width = video.videoWidth;
        const height = video.videoHeight;
        setVideoWidth(width);
        setVideoHeight(height);
        setIsVertical(height > width);
      };

      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      // If already loaded
      if (video.readyState >= 1) {
        handleLoadedMetadata();
      }

      return () => {
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      };
    }
  }, [uploadedUrl]);

  // Fetch products when moving to step 3
  useEffect(() => {
    if (step === 3 && products.length === 0) {
      fetchProducts();
    }
  }, [step]);

  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const userProducts = await getProducts();
      setProducts(userProducts);
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const handleFileUploadSuccess = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setIsUploading(true);

    try {
      // 1. Get presigned URL
      const { uploadUrl, publicUrl } = await getDemoUploadPresignedUrl(
        uploadedFile.name,
        uploadedFile.type
      );

      // 2. Upload to S3
      await fetch(uploadUrl, {
        method: "PUT",
        body: uploadedFile,
        headers: { "Content-Type": uploadedFile.type },
      });

      // Store the uploaded URL and move to step 2 (region selection)
      setUploadedUrl(publicUrl);
      setStep(2);
    } catch (error) {
      console.error("Upload failed", error);
      alert("Upload failed. Check console.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUploadError = (error: { message: string; code: string }) => {
    console.error("File upload error:", error);
    alert(`Upload error: ${error.message}`);
  };

  const handleFinish = async () => {
    if (!file || !uploadedUrl) return;

    setIsUploading(true);
    try {
      // Save to DB with optional productId and talking head regions
      await createDemoRecord({
        url: uploadedUrl,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        title: title || file.name,
        productId: selectedProductId || undefined,
        width: videoWidth || undefined,
        height: videoHeight || undefined,
        talkingHeadRegions: talkingHeadRegions.length > 0 ? talkingHeadRegions : undefined,
      });

      setOpen(false);
      setFile(null);
      setTitle("");
      setUploadedUrl(null);
      setVideoWidth(null);
      setVideoHeight(null);
      setIsVertical(null);
      setTalkingHeadRegions([]);
      setSelectedProductId("");
      setStep(1);
      window.location.reload();
    } catch (error) {
      console.error("Failed to save demo", error);
      alert("Failed to save demo. Check console.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleBack = () => {
    if (step === 3) {
      setStep(2);
      setSelectedProductId("");
    } else if (step === 2) {
      setStep(1);
      setTalkingHeadRegions([]);
    }
  };

  const handleContinueFromRegions = () => {
    // If vertical video, require at least one region
    if (isVertical && talkingHeadRegions.length === 0) {
      alert("Please select at least one region for talking head placement. This is required for vertical videos.");
      return;
    }
    setStep(3);
  };

  const isRegionsStep = step === 2;
  const hasRegions = talkingHeadRegions.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Upload Demo</Button>
      </DialogTrigger>
      {isRegionsStep ? (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/50 z-40 transition-opacity" onClick={() => setOpen(false)} />

          {/* Modal Container */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
            <div
              className={`pointer-events-auto transition-all duration-500 ease-out w-full ${
                hasRegions ? "max-w-[800px]" : "max-w-[400px]"
              }`}
            >
              <div className="flex gap-4">
                {/* Main Video Container */}
                <div className="flex-shrink-0">
                  <div className="bg-card rounded-lg overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 w-80">
                    {uploadedUrl ? (
                      <>
                        <video
                          ref={videoRef}
                          src={uploadedUrl}
                          className="hidden"
                          preload="metadata"
                        />
                        <VideoRegionSelector
                          videoUrl={uploadedUrl}
                          regions={talkingHeadRegions}
                          onRegionsChange={setTalkingHeadRegions}
                          isRequired={isVertical === true}
                          showSidePanel={false}
                          onSidePanelRender={setRegionsSidePanel}
                        />
                      </>
                    ) : (
                      <div className="w-full aspect-[9/16] flex flex-col items-center justify-center gap-3 text-zinc-500">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p className="text-sm">Loading video...</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Side Panel - Selected Regions */}
                {regionsSidePanel}

                {/* Control Buttons */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => setOpen(false)}
                    className="h-10 w-10 flex items-center justify-center bg-card hover:bg-muted rounded-full text-foreground transition-colors shadow-lg border border-zinc-200 dark:border-zinc-800"
                    aria-label="Close modal"
                  >
                    <X size={20} />
                  </button>
                  <button
                    onClick={handleBack}
                    disabled={isUploading}
                    className="h-10 rounded-full transition-all shadow-lg font-semibold flex items-center justify-center gap-2 px-3 border bg-card text-foreground hover:bg-muted border-zinc-200 dark:border-zinc-800 disabled:opacity-50"
                    aria-label="Back"
                  >
                    <ChevronLeft size={18} />
                    <span className="text-xs hidden sm:inline">Back</span>
                  </button>
                  <button
                    onClick={handleContinueFromRegions}
                    disabled={isUploading}
                    className="h-10 rounded-full transition-all shadow-lg font-semibold flex items-center justify-center gap-2 px-3 border bg-primary text-primary-foreground hover:bg-primary/90 border-primary disabled:opacity-50"
                    aria-label="Continue"
                  >
                    <span className="text-xs hidden sm:inline">Continue</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1
              ? "Upload Demo"
              : step === 2
              ? "Select Talking Head Regions"
              : "Attach to Product"}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Upload a video demo to showcase your work."
              : step === 2
              ? isVertical
                ? "Select regions where it's safe to place a talking head. This is required for vertical videos."
                : "Optionally select regions for talking head placement. For horizontal videos, we'll place it above or below."
              : "Optionally attach this demo to a product."}
          </DialogDescription>
        </DialogHeader>
        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="text-sm font-medium mb-2 block">
                Title (optional)
              </label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Demo title"
                disabled={isUploading}
              />
            </div>
            <FileUpload
              onUploadSuccess={handleFileUploadSuccess}
              onUploadError={handleFileUploadError}
              acceptedFileTypes={["video/*"]}
              maxFileSize={100 * 1024 * 1024} // 100MB
              uploadDelay={0} // Disable simulation, we'll handle real upload
            />
            {isUploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Uploading ...</span>
              </div>
            )}
          </div>
        ) : step === 2 ? (
          <div className="space-y-4">
            {uploadedUrl && (
              <>
                <video
                  ref={videoRef}
                  src={uploadedUrl}
                  className="hidden"
                  preload="metadata"
                />
                <VideoRegionSelector
                  videoUrl={uploadedUrl}
                  regions={talkingHeadRegions}
                  onRegionsChange={setTalkingHeadRegions}
                  isRequired={isVertical === true}
                  showSidePanel={false}
                  onSidePanelRender={setRegionsSidePanel}
                />
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="product"
                className="text-sm font-medium mb-2 block"
              >
                Attach to Product (Optional)
              </label>
              {isLoadingProducts ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading products...</span>
                </div>
              ) : (
                <select
                  id="product"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  disabled={isUploading}
                  className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">No product (skip)</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.title || "Untitled Product"}
                    </option>
                  ))}
                </select>
              )}
              {products.length === 0 && !isLoadingProducts && (
                <p className="text-sm text-muted-foreground mt-2">
                  No products available. You can skip this step.
                </p>
              )}
            </div>
            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isUploading}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleFinish} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Finish
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
        </DialogContent>
      )}
    </Dialog>
  );
}

