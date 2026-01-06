"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Loader2, 
  Image as ImageIcon, 
  Video, 
  Trash2, 
  Play,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";
import { 
  generateCompositeImageForJob,
  generateVeoClipForJob,
  deleteCompositeImage,
  deleteVeoClip,
  getCompositeImagesForJob,
} from "@/actions/video-jobs-manual";
import { getVideoJob } from "@/actions/video-jobs";
import type { VideoGenerationPlan } from "@/types/video-generation";

interface VideoJob {
  id: string;
  status: string;
  tone: string;
  targetDuration: number;
  directorPlan: unknown;
  compositeImageIds: string[];
  veoClipUrls: string[];
  product?: {
    id: string;
    title: string | null;
    images: string[];
  };
  avatar?: {
    id: string;
    imageUrl: string | null;
  };
}

interface CompositeImage {
  id: string;
  imageUrl: string;
  prompt: string;
  description: string;
}

interface VeoClip {
  callId: string;
  url?: string;
  prompt: string;
  sourceImageType: string;
  sourceImageRef: string;
}

export function VideoJobManager({ initialJob }: { initialJob: VideoJob }) {
  const [job, setJob] = useState<VideoJob>(initialJob);
  const [plan, setPlan] = useState<VideoGenerationPlan | null>(
    initialJob.directorPlan as VideoGenerationPlan | null
  );
  const [composites, setComposites] = useState<Map<string, CompositeImage>>(new Map());
  const [veoClips, setVeoClips] = useState<Map<string, VeoClip>>(new Map());
  const [generatingComposite, setGeneratingComposite] = useState<string | null>(null);
  const [generatingVeo, setGeneratingVeo] = useState<string | null>(null);
  const [deletingComposite, setDeletingComposite] = useState<string | null>(null);
  const [deletingVeo, setDeletingVeo] = useState<string | null>(null);

  // Load composite images
  useEffect(() => {
    async function loadComposites() {
      if (!plan || !job.compositeImageIds) return;

      try {
        const dbComposites = await getCompositeImagesForJob(job.id);
        const compositeMap = new Map<string, CompositeImage>();
        
        for (const compositeId of job.compositeImageIds as string[]) {
          const dbComposite = dbComposites.find((c) => c.id === compositeId);
          const taskIndex = (job.compositeImageIds as string[]).indexOf(compositeId);
          const task = plan.imageGeneration[taskIndex];
          
          if (task) {
            compositeMap.set(compositeId, {
              id: compositeId,
              imageUrl: dbComposite?.imageUrl || "",
              prompt: task.prompt,
              description: task.description,
            });
          }
        }
        setComposites(compositeMap);
      } catch (err) {
        console.error("Error loading composites:", err);
      }
    }
    loadComposites();
  }, [plan, job.compositeImageIds, job.id]);

  // Load Veo clips from plan
  useEffect(() => {
    if (!plan) return;

    const clipMap = new Map<string, VeoClip>();
    for (const veoCall of plan.veoCalls) {
      const existingUrl = (job.veoClipUrls as string[] || []).find((url, idx) => {
        // Simple matching - in real implementation, you'd track which URL corresponds to which callId
        return idx === plan.veoCalls.indexOf(veoCall);
      });
      
      clipMap.set(veoCall.callId, {
        callId: veoCall.callId,
        url: existingUrl,
        prompt: veoCall.prompt,
        sourceImageType: veoCall.sourceImageType,
        sourceImageRef: veoCall.sourceImageRef,
      });
    }
    setVeoClips(clipMap);
  }, [plan, job.veoClipUrls]);

  async function handleGenerateComposite(compositeId: string) {
    setGeneratingComposite(compositeId);
    try {
      const result = await generateCompositeImageForJob({
        jobId: job.id,
        compositeId,
      });
      
      // Update composite with image URL
      setComposites((prev) => {
        const updated = new Map(prev);
        const composite = updated.get(compositeId);
        if (composite) {
          updated.set(compositeId, { ...composite, imageUrl: result.imageUrl });
        }
        return updated;
      });

      // Refresh job
      const updatedJob = await getVideoJob(job.id);
      setJob(updatedJob);
    } catch (err) {
      console.error("Error generating composite:", err);
      alert(err instanceof Error ? err.message : "Failed to generate composite");
    } finally {
      setGeneratingComposite(null);
    }
  }

  async function handleGenerateVeo(veoCallId: string) {
    setGeneratingVeo(veoCallId);
    try {
      const result = await generateVeoClipForJob({
        jobId: job.id,
        veoCallId,
      });
      
      // Update Veo clip with URL
      setVeoClips((prev) => {
        const updated = new Map(prev);
        const clip = updated.get(veoCallId);
        if (clip) {
          updated.set(veoCallId, { ...clip, url: result.url });
        }
        return updated;
      });

      // Refresh job
      const updatedJob = await getVideoJob(job.id);
      setJob(updatedJob);
    } catch (err) {
      console.error("Error generating Veo clip:", err);
      alert(err instanceof Error ? err.message : "Failed to generate Veo clip");
    } finally {
      setGeneratingVeo(null);
    }
  }

  async function handleDeleteComposite(compositeId: string) {
    if (!confirm("Are you sure you want to delete this composite image? You can regenerate it later.")) {
      return;
    }

    setDeletingComposite(compositeId);
    try {
      await deleteCompositeImage({
        jobId: job.id,
        compositeId,
      });
      
      // Remove from state
      setComposites((prev) => {
        const updated = new Map(prev);
        updated.delete(compositeId);
        return updated;
      });

      // Refresh job
      const updatedJob = await getVideoJob(job.id);
      setJob(updatedJob);
    } catch (err) {
      console.error("Error deleting composite:", err);
      alert(err instanceof Error ? err.message : "Failed to delete composite");
    } finally {
      setDeletingComposite(null);
    }
  }

  async function handleDeleteVeo(veoCallId: string, url: string) {
    if (!confirm("Are you sure you want to delete this Veo clip? You can regenerate it later.")) {
      return;
    }

    setDeletingVeo(veoCallId);
    try {
      await deleteVeoClip({
        jobId: job.id,
        veoClipUrl: url,
      });
      
      // Remove URL from clip
      setVeoClips((prev) => {
        const updated = new Map(prev);
        const clip = updated.get(veoCallId);
        if (clip) {
          updated.set(veoCallId, { ...clip, url: undefined });
        }
        return updated;
      });

      // Refresh job
      const updatedJob = await getVideoJob(job.id);
      setJob(updatedJob);
    } catch (err) {
      console.error("Error deleting Veo clip:", err);
      alert(err instanceof Error ? err.message : "Failed to delete Veo clip");
    } finally {
      setDeletingVeo(null);
    }
  }

  if (!plan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Video Job</CardTitle>
          <CardDescription>No director plan found. Please create a plan first.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Job Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Video Job Overview</CardTitle>
          <CardDescription>
            Status: <span className="font-medium">{job.status}</span> • 
            Duration: <span className="font-medium">{plan.totalDuration}s</span> • 
            Tone: <span className="font-medium">{job.tone}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Product</p>
              <p className="font-medium">{job.product?.title || "Untitled"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Segments</p>
              <p className="font-medium">{plan.segments.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Veo Calls</p>
              <p className="font-medium">{plan.veoCalls.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Composite Images</p>
              <p className="font-medium">{plan.imageGeneration.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Composite Images */}
      {plan.imageGeneration.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Composite Images
            </CardTitle>
            <CardDescription>
              Generate composite images manually. Each composite combines the avatar with product images.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from(composites.entries()).map(([compositeId, composite]) => {
                const isGenerated = !!composite.imageUrl;
                const isGenerating = generatingComposite === compositeId;
                const isDeleting = deletingComposite === compositeId;

                return (
                  <div
                    key={compositeId}
                    className="flex items-start gap-4 rounded-lg border p-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{composite.description}</h4>
                        {isGenerated ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {composite.prompt}
                      </p>
                      {isGenerated && (
                        <div className="mt-2 rounded-lg overflow-hidden border max-w-xs">
                          <img
                            src={composite.imageUrl}
                            alt={composite.description}
                            className="w-full h-auto"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {!isGenerated ? (
                        <Button
                          onClick={() => handleGenerateComposite(compositeId)}
                          disabled={isGenerating}
                          size="sm"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4" />
                              Generate
                            </>
                          )}
                        </Button>
                      ) : (
                        <>
                          <Button
                            onClick={() => handleGenerateComposite(compositeId)}
                            disabled={isGenerating}
                            variant="outline"
                            size="sm"
                          >
                            {isGenerating ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Regenerating...
                              </>
                              ) : (
                                <>
                                  <Play className="w-4 h-4" />
                                  Regenerate
                                </>
                              )}
                          </Button>
                          <Button
                            onClick={() => handleDeleteComposite(compositeId)}
                            disabled={isDeleting}
                            variant="destructive"
                            size="sm"
                          >
                            {isDeleting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </>
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Veo Clips */}
      {plan.veoCalls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="w-5 h-5" />
              Veo Video Clips
            </CardTitle>
            <CardDescription>
              Generate Veo video clips manually. Each clip is 8 seconds long.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from(veoClips.entries()).map(([veoCallId, clip]) => {
                const isGenerated = !!clip.url;
                const isGenerating = generatingVeo === veoCallId;
                const isDeleting = deletingVeo === veoCallId;

                return (
                  <div
                    key={veoCallId}
                    className="flex items-start gap-4 rounded-lg border p-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">Veo Call: {veoCallId}</h4>
                        {isGenerated ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Source: {clip.sourceImageType} ({clip.sourceImageRef})
                      </p>
                      <p className="text-xs text-muted-foreground mb-2 font-mono bg-muted p-2 rounded">
                        {clip.prompt.substring(0, 200)}...
                      </p>
                      {isGenerated && clip.url && (
                        <div className="mt-2 rounded-lg overflow-hidden border max-w-md">
                          <video
                            src={clip.url}
                            controls
                            className="w-full h-auto"
                          >
                            Your browser does not support the video tag.
                          </video>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {!isGenerated ? (
                        <Button
                          onClick={() => handleGenerateVeo(veoCallId)}
                          disabled={isGenerating}
                          size="sm"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4" />
                              Generate
                            </>
                          )}
                        </Button>
                      ) : (
                        <>
                          <Button
                            onClick={() => handleGenerateVeo(veoCallId)}
                            disabled={isGenerating}
                            variant="outline"
                            size="sm"
                          >
                            {isGenerating ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Regenerating...
                              </>
                            ) : (
                              <>
                                <Play className="w-4 h-4" />
                                Regenerate
                              </>
                            )}
                          </Button>
                          {clip.url && (
                            <Button
                              onClick={() => handleDeleteVeo(veoCallId, clip.url!)}
                              disabled={isDeleting}
                              variant="destructive"
                              size="sm"
                            >
                              {isDeleting ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Deleting...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </>
                              )}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

