"use client";

import { useState } from "react";
import { Video, Trash2, Edit2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { deleteDemo, updateDemo } from "@/actions/demos";
import { useRouter } from "next/navigation";

type Demo = {
  id: string;
  url: string;
  filename: string;
  title: string | null;
  createdAt: Date;
};

export function DemoList({ demos }: { demos: Demo[] }) {
  const router = useRouter();
  const [editingDemo, setEditingDemo] = useState<Demo | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleEdit = (demo: Demo) => {
    setEditingDemo(demo);
    setEditTitle(demo.title || "");
  };

  const handleSave = async () => {
    if (!editingDemo) return;
    setIsUpdating(true);
    try {
      await updateDemo(editingDemo.id, editTitle);
      setEditingDemo(null);
      router.refresh();
    } catch (error) {
      console.error("Failed to update demo:", error);
      alert("Failed to update demo");
    } finally {
      setIsUpdating(false);
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
      <Dialog open={!!editingDemo} onOpenChange={(open) => !open && setEditingDemo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Demo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Demo title"
                disabled={isUpdating}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingDemo(null)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isUpdating}>
                {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

