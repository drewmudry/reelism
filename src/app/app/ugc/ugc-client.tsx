"use client";

import { useState, useEffect } from "react";
import { createVideoJob, getVideoJob } from "@/actions/video-jobs";
import { testDirector } from "@/actions/test-director";
import { ProductList } from "@/components/product/product-list";
import { AvatarListModal } from "@/components/avatar/avatar-list-modal";
import { Button } from "@/components/ui/button";
import { Loader2, Video, Download, AlertCircle } from "lucide-react";
import { getProducts } from "@/actions/products";
import { getAvatars } from "@/actions/get-avatars";
import { getUserDemos } from "@/actions/demos";

interface Product {
  id: string;
  title: string | null;
  images: string[];
}

interface Avatar {
  id: string;
  imageUrl: string | null;
}

interface Demo {
  id: string;
  title: string | null;
  description: string | null;
}

interface VideoJob {
  id: string;
  status: string;
  tone: string;
  targetDuration: number;
  finalVideoUrl: string | null;
  error: string | null;
  product?: Product;
  avatar?: Avatar;
  createdAt: Date;
}

export function UGCClient({ initialJobs }: { initialJobs: VideoJob[] }) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [selectedDemos, setSelectedDemos] = useState<Demo[]>([]);
  const [tone, setTone] = useState("energetic and authentic");
  const [jobs, setJobs] = useState<VideoJob[]>(initialJobs);
  const [generating, setGenerating] = useState(false);
  const [testingDirector, setTestingDirector] = useState(false);
  const [directorResult, setDirectorResult] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [demos, setDemos] = useState<Demo[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isLoadingAvatars, setIsLoadingAvatars] = useState(false);
  const [isLoadingDemos, setIsLoadingDemos] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchAvatars();
    fetchDemos();
  }, []);

  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const fetchAvatars = async () => {
    setIsLoadingAvatars(true);
    try {
      const data = await getAvatars();
      setAvatars(data);
    } catch (error) {
      console.error("Failed to fetch avatars:", error);
    } finally {
      setIsLoadingAvatars(false);
    }
  };

  const fetchDemos = async () => {
    setIsLoadingDemos(true);
    try {
      const data = await getUserDemos();
      setDemos(data);
    } catch (error) {
      console.error("Failed to fetch demos:", error);
    } finally {
      setIsLoadingDemos(false);
    }
  };

  const handleTestDirector = async () => {
    if (!selectedProduct || !selectedAvatar) return;

    setTestingDirector(true);
    setDirectorResult(null);
    try {
      const result = await testDirector({
        productId: selectedProduct.id,
        avatarId: selectedAvatar.id,
        demoIds: selectedDemos.map((d) => d.id),
        tone,
      });
      setDirectorResult(result);
      console.log("Director Result:", result);
    } catch (error) {
      console.error("Failed to test director:", error);
      alert(`Failed to test director: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setTestingDirector(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedProduct || !selectedAvatar) return;

    setGenerating(true);
    try {
      const { jobId } = await createVideoJob({
        productId: selectedProduct.id,
        avatarId: selectedAvatar.id,
        demoIds: selectedDemos.map((d) => d.id),
        tone,
        // Duration will be determined by the director (16-24 seconds to maximize Veo clip utilization)
      });

      // Poll for status
      pollJobStatus(jobId);
    } catch (error) {
      console.error("Failed to create job:", error);
      alert("Failed to create video job. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const job = await getVideoJob(jobId);

        setJobs((prev) => {
          const existing = prev.find((j) => j.id === jobId);
          if (existing) {
            return prev.map((j) => (j.id === jobId ? job : j));
          }
          return [job, ...prev];
        });

        if (job.status === "completed" || job.status === "failed") {
          clearInterval(interval);
        }
      } catch (error) {
        console.error("Failed to poll job status:", error);
        clearInterval(interval);
      }
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Create UGC Video</h1>
        <p className="text-muted-foreground mt-1">
          Generate authentic UGC-style videos with your products and avatars
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Product Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">Product</label>
          {selectedProduct ? (
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              {selectedProduct.images[0] && (
                <img
                  src={selectedProduct.images[0]}
                  alt={selectedProduct.title || "Product"}
                  className="w-16 h-16 object-cover rounded"
                />
              )}
              <div className="flex-1">
                <p className="font-medium">{selectedProduct.title || "Untitled Product"}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProduct(null)}
                  className="mt-1"
                >
                  Change
                </Button>
              </div>
            </div>
          ) : (
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">Select a product</p>
              {isLoadingProducts ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : products.length === 0 ? (
                <p className="text-sm text-muted-foreground">No products available</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {products.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className="w-full flex items-center gap-2 p-2 hover:bg-gray-100 rounded text-left"
                    >
                      {product.images[0] && (
                        <img
                          src={product.images[0]}
                          alt={product.title || "Product"}
                          className="w-10 h-10 object-cover rounded"
                        />
                      )}
                      <span className="text-sm">{product.title || "Untitled Product"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Avatar Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">Avatar</label>
          <div className="border rounded-lg p-4">
            {isLoadingAvatars ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : avatars.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No avatars available</p>
            ) : (
              <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                {avatars.map((avatar) => (
                  <button
                    key={avatar.id}
                    onClick={() => setSelectedAvatar(avatar)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      selectedAvatar?.id === avatar.id
                        ? "border-green-500 ring-2 ring-green-200"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {avatar.imageUrl ? (
                      <img
                        src={avatar.imageUrl}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <span className="text-xs text-gray-400">No image</span>
                      </div>
                    )}
                    {selectedAvatar?.id === avatar.id && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Demo Selection (optional) */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">Demo Videos (optional)</label>
          <div className="border rounded-lg p-4">
            {isLoadingDemos ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : demos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No demo videos available</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {demos.map((demo) => (
                  <label key={demo.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDemos.some((d) => d.id === demo.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDemos([...selectedDemos, demo]);
                        } else {
                          setSelectedDemos(selectedDemos.filter((d) => d.id !== demo.id));
                        }
                      }}
                    />
                    <span className="text-sm">{demo.title || demo.description || demo.id}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tone */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">Tone</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="energetic and authentic">Energetic & Authentic</option>
            <option value="calm and conversational">Calm & Conversational</option>
            <option value="excited unboxing">Excited Unboxing</option>
            <option value="luxury and aspirational">Luxury & Aspirational</option>
          </select>
        </div>

      </div>

      {/* Test Director Button */}
      <Button
        onClick={handleTestDirector}
        disabled={!selectedProduct || !selectedAvatar || testingDirector}
        variant="outline"
        className="w-full"
        size="lg"
      >
        {testingDirector ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Testing Director...
          </>
        ) : (
          <>
            Test Director (Step 1)
          </>
        )}
      </Button>

      {/* Director Result Display */}
      {directorResult && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <h3 className="font-semibold mb-2">Director Test Result</h3>
          <div className="space-y-2 text-sm">
            <div>
              <strong>Valid:</strong> {directorResult.validation.valid ? "✅ Yes" : "❌ No"}
            </div>
            {directorResult.validation.errors.length > 0 && (
              <div>
                <strong>Errors:</strong>
                <ul className="list-disc list-inside text-red-600">
                  {directorResult.validation.errors.map((err: string, i: number) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            {directorResult.validation.warnings.length > 0 && (
              <div>
                <strong>Warnings:</strong>
                <ul className="list-disc list-inside text-yellow-600">
                  {directorResult.validation.warnings.map((warn: string, i: number) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <strong>Chosen Duration:</strong> {directorResult.plan.totalDuration}s
            </div>
            <div>
              <strong>Veo Calls:</strong> {directorResult.plan.veoCalls.length}
            </div>
            <div>
              <strong>Segments:</strong> {directorResult.plan.segments.length}
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                View Full Plan (JSON)
              </summary>
              <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto max-h-96">
                {JSON.stringify(directorResult.plan, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={!selectedProduct || !selectedAvatar || generating}
        className="w-full"
        size="lg"
      >
        {generating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <Video className="w-4 h-4 mr-2" />
            Generate Video
          </>
        )}
      </Button>

      {/* Jobs List */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Your Videos</h2>
        <div className="space-y-4">
          {jobs.length === 0 ? (
            <p className="text-muted-foreground">No videos generated yet</p>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <p className="font-medium">{job.product?.title || "Untitled Product"}</p>
                    <p className="text-sm text-muted-foreground capitalize">{job.status}</p>
                    {job.error && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-red-500">
                        <AlertCircle className="w-4 h-4" />
                        <span>{job.error}</span>
                      </div>
                    )}
                  </div>
                  {job.status === "completed" && job.finalVideoUrl && (
                    <a
                      href={job.finalVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-500 hover:underline"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

