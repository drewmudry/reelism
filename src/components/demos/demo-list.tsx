"use client";

import { useState, useEffect, useRef } from "react";
import { Video, Trash2, Edit2, Loader2, X, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { deleteDemo, updateDemo } from "@/actions/demos";
import { useRouter } from "next/navigation";
import { VideoRegionSelector, TalkingHeadRegion } from "./video-region-selector";
import { getProducts } from "@/actions/products";

type Demo = {
  id: string;
  url: string;
  filename: string;
  title: string | null;
  productId: string | null;
  width: number | null;
  height: number | null;
  talkingHeadRegions: TalkingHeadRegion[] | null;
  createdAt: Date;
};

type Product = {
  id: string;
  title: string | null;
};

export function DemoList({ demos }: { demos: Demo[] }) {
  const router = useRouter();
  const [editingDemo, setEditingDemo] = useState<Demo | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editProductId, setEditProductId] = useState<string>("");
  const [editRegions, setEditRegions] = useState<TalkingHeadRegion[]>([]);
  const [regionsSidePanel, setRegionsSidePanel] = useState<React.ReactNode>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVertical, setIsVertical] = useState<boolean | null>(null);

  useEffect(() => {
    if (editingDemo) {
      setEditTitle(editingDemo.title || "");
      setEditProductId(editingDemo.productId || "");
      setEditRegions(editingDemo.talkingHeadRegions || []);
      setStep(1);
      setIsVertical(editingDemo.height && editingDemo.width ? editingDemo.height > editingDemo.width : null);
    }
  }, [editingDemo]);

  useEffect(() => {
    if (editingDemo && products.length === 0) {
      fetchProducts();
    }
  }, [editingDemo]);

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

  const handleEdit = (demo: Demo) => {
    setEditingDemo(demo);
  };

  const handleSave = async () => {
    if (!editingDemo) return;
    setIsUpdating(true);
    try {
      await updateDemo({
        demoId: editingDemo.id,
        title: editTitle,
        productId: editProductId || null,
        talkingHeadRegions: editRegions,
      });
      setEditingDemo(null);
      router.refresh();
    } catch (error) {
      console.error("Failed to update demo:", error);
      alert("Failed to update demo");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleContinueFromRegions = () => {
    if (isVertical && editRegions.length === 0) {
      alert("Please select at least one region for talking head placement. This is required for vertical videos.");
      return;
    }
    setStep(2);
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    }
  };

  const handleDelete = async (demoId: string) => {
    if (!confirm("Are you sure you want to delete this demo?")) return;
    setDeletingId(demoId);
    try {
      await deleteDemo(demoId);
      router.refresh();
    } catch (error) {
      console.error("Failed to delete demo:", error);
      alert("Failed to delete demo");
    } finally {
      setDeletingId(null);
    }
  };

  if (demos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No demos yet. Upload your first demo to get started.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {demos.map((demo) => (
          <div
            key={demo.id}
            className="group relative cursor-pointer overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900 aspect-[9/16] transition-transform hover:scale-[1.02] border border-zinc-200 dark:border-zinc-800"
          >
            <video
              src={demo.url}
              className="h-full w-full object-cover"
              loop
              muted
              playsInline
              preload="metadata"
              onMouseEnter={(e) => {
                const video = e.currentTarget;
                video.play().catch(() => {});
              }}
              onMouseLeave={(e) => {
                const video = e.currentTarget;
                video.pause();
                video.currentTime = 0;
              }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300 pointer-events-none" />
            
            {/* Actions overlay */}
            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(demo);
                }}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="destructive"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(demo.id);
                }}
                disabled={deletingId === demo.id}
              >
                {deletingId === demo.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Title overlay */}
            {demo.title && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                <p className="text-white text-sm font-medium truncate">
                  {demo.title}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit Dialog */}
      {editingDemo && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/50 z-40 transition-opacity" onClick={() => setEditingDemo(null)} />

          {/* Modal Container */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
            <div
              className={`pointer-events-auto transition-all duration-500 ease-out ${
                step === 2 && editRegions.length > 0 ? "max-w-[800px]" : step === 2 ? "max-w-[400px]" : step === 1 ? "max-w-[400px]" : "max-w-[400px]"
              }`}
            >
              <div className="flex gap-4">
                {step === 1 ? (
                  <>
                    {/* Main Form Container */}
                    <div className="flex-shrink-0">
                      <div className="bg-card rounded-lg overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 w-80">
                        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                          <h3 className="text-lg font-semibold">Edit Demo</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Update title, product, and regions
                          </p>
                        </div>
                        <div className="p-4 space-y-4">
                          <div>
                            <label htmlFor="edit-title" className="text-sm font-medium mb-2 block">
                              Title
                            </label>
                            <Input
                              id="edit-title"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              placeholder="Demo title"
                              disabled={isUpdating}
                            />
                          </div>
                          <div>
                            <label htmlFor="edit-product" className="text-sm font-medium mb-2 block">
                              Product (Optional)
                            </label>
                            {isLoadingProducts ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Loading products...</span>
                              </div>
                            ) : (
                              <select
                                id="edit-product"
                                value={editProductId}
                                onChange={(e) => setEditProductId(e.target.value)}
                                disabled={isUpdating}
                                className="w-full px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                              >
                                <option value="">No product</option>
                                {products.map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.title || "Untitled Product"}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-2 block">
                              Talking Head Regions
                            </label>
                            <Button
                              variant="outline"
                              onClick={() => setStep(2)}
                              className="w-full"
                              disabled={isUpdating}
                            >
                              {editRegions.length > 0
                                ? `Edit Regions (${editRegions.length} selected)`
                                : "Edit Regions"}
                              <ChevronRight className="h-4 w-4 ml-2" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Control Buttons */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => setEditingDemo(null)}
                        className="h-10 w-10 flex items-center justify-center bg-card hover:bg-muted rounded-full text-foreground transition-colors shadow-lg border border-zinc-200 dark:border-zinc-800"
                        aria-label="Close modal"
                      >
                        <X size={20} />
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={isUpdating}
                        className="h-10 rounded-full transition-all shadow-lg font-semibold flex items-center justify-center gap-2 px-3 border bg-primary text-primary-foreground hover:bg-primary/90 border-primary disabled:opacity-50"
                        aria-label="Save"
                      >
                        {isUpdating ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <>
                            <span className="text-xs hidden sm:inline">Save</span>
                            <ChevronRight size={18} />
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Region Selection Step - Video Container */}
                    <div className="flex-shrink-0">
                      <div className="bg-card rounded-lg overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 w-80">
                        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                          <h3 className="text-lg font-semibold">Edit Regions</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {isVertical
                              ? "Select regions where it's safe to place a talking head. This is required for vertical videos."
                              : "Optionally select regions for talking head placement."}
                          </p>
                        </div>
                        {editingDemo && (
                          <>
                            <video
                              ref={videoRef}
                              src={editingDemo.url}
                              className="hidden"
                              preload="metadata"
                            />
                            <VideoRegionSelector
                              videoUrl={editingDemo.url}
                              regions={editRegions}
                              onRegionsChange={setEditRegions}
                              isRequired={isVertical === true}
                              showSidePanel={false}
                              onSidePanelRender={setRegionsSidePanel}
                            />
                          </>
                        )}
                      </div>
                    </div>

                    {/* Side Panel - Selected Regions */}
                    {regionsSidePanel}

                    {/* Control Buttons */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => setEditingDemo(null)}
                        className="h-10 w-10 flex items-center justify-center bg-card hover:bg-muted rounded-full text-foreground transition-colors shadow-lg border border-zinc-200 dark:border-zinc-800"
                        aria-label="Close modal"
                      >
                        <X size={20} />
                      </button>
                      <button
                        onClick={handleBack}
                        disabled={isUpdating}
                        className="h-10 rounded-full transition-all shadow-lg font-semibold flex items-center justify-center gap-2 px-3 border bg-card text-foreground hover:bg-muted border-zinc-200 dark:border-zinc-800 disabled:opacity-50"
                        aria-label="Back"
                      >
                        <ChevronLeft size={18} />
                        <span className="text-xs hidden sm:inline">Back</span>
                      </button>
                      <button
                        onClick={handleContinueFromRegions}
                        disabled={isUpdating}
                        className="h-10 rounded-full transition-all shadow-lg font-semibold flex items-center justify-center gap-2 px-3 border bg-primary text-primary-foreground hover:bg-primary/90 border-primary disabled:opacity-50"
                        aria-label="Continue"
                      >
                        <span className="text-xs hidden sm:inline">Continue</span>
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

