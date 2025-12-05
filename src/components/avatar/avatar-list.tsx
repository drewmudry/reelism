"use client";

import { useState, useEffect } from "react";
import { getAvatars, getAvatarById, deleteAvatar, updateAvatarPrompt, regenerateAvatar } from "@/actions/get-avatars";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Save, RefreshCw } from "lucide-react";
import { EditablePrompt } from "./editable-prompt";

interface Avatar {
  id: string;
  imageUrl: string | null;
  prompt: any;
  createdAt: Date;
  updatedAt: Date;
}

export function AvatarList() {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [editedPrompt, setEditedPrompt] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    async function fetchAvatars() {
      try {
        const data = await getAvatars();
        // Filter to only show avatars with images
        setAvatars(data.filter((avatar) => avatar.imageUrl));
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching avatars:", err);
        setError(err instanceof Error ? err.message : "Failed to load avatars");
        setIsLoading(false);
      }
    }

    fetchAvatars();
  }, []);

  async function handleAvatarClick(avatar: Avatar) {
    try {
      // Fetch full avatar data to ensure we have the latest prompt
      const fullAvatar = await getAvatarById(avatar.id);
      setSelectedAvatar(fullAvatar);
      setEditedPrompt(fullAvatar.prompt);
    } catch (err) {
      console.error("Error fetching avatar details:", err);
      // Fallback to the avatar we already have
      setSelectedAvatar(avatar);
      setEditedPrompt(avatar.prompt);
    }
  }

  async function handleSave() {
    if (!selectedAvatar || !editedPrompt) return;

    setIsSaving(true);
    try {
      await updateAvatarPrompt(selectedAvatar.id, editedPrompt);
      // Update the avatar in the list
      setAvatars(
        avatars.map((a) =>
          a.id === selectedAvatar.id ? { ...a, prompt: editedPrompt } : a
        )
      );
      // Update selected avatar
      setSelectedAvatar({ ...selectedAvatar, prompt: editedPrompt });
    } catch (err) {
      console.error("Error saving prompt:", err);
      setError(err instanceof Error ? err.message : "Failed to save prompt");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRegenerate() {
    if (!selectedAvatar) return;

    setIsRegenerating(true);
    try {
      const result = await regenerateAvatar(selectedAvatar.id);
      // Refresh the avatars list to show the new avatar
      const data = await getAvatars();
      setAvatars(data.filter((avatar) => avatar.imageUrl));
      // Close the modal
      setSelectedAvatar(null);
      setEditedPrompt(null);
    } catch (err) {
      console.error("Error regenerating avatar:", err);
      setError(err instanceof Error ? err.message : "Failed to regenerate avatar");
    } finally {
      setIsRegenerating(false);
    }
  }

  async function handleDelete() {
    if (!selectedAvatar) return;

    if (!confirm("Are you sure you want to delete this avatar? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAvatar(selectedAvatar.id);
      // Remove from list
      setAvatars(avatars.filter((a) => a.id !== selectedAvatar.id));
      // Close modal
      setSelectedAvatar(null);
    } catch (err) {
      console.error("Error deleting avatar:", err);
      setError(err instanceof Error ? err.message : "Failed to delete avatar");
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-zinc-600 dark:text-zinc-400">Loading avatars...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
        Error: {error}
      </div>
    );
  }

  if (avatars.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-zinc-600 dark:text-zinc-400">No avatars found</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-5 gap-4">
        {avatars.map((avatar) => (
          <div
            key={avatar.id}
            className="cursor-pointer group"
            onClick={() => handleAvatarClick(avatar)}
          >
            <div className="relative overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 transition-transform group-hover:scale-[1.02]">
              {avatar.imageUrl ? (
                <img
                  src={avatar.imageUrl}
                  alt={`Avatar ${avatar.id}`}
                  className="w-full h-auto aspect-[3/4] object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="aspect-[3/4] flex items-center justify-center bg-zinc-200 dark:bg-zinc-800">
                  <p className="text-sm text-zinc-500">No image</p>
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            </div>
          </div>
        ))}
      </div>

      <Dialog
        open={!!selectedAvatar}
        onOpenChange={(open) => !open && setSelectedAvatar(null)}
      >
        <DialogContent
          className="max-w-6xl p-0 max-h-[90vh] overflow-hidden flex flex-col"
          onClose={() => setSelectedAvatar(null)}
        >
          {selectedAvatar && (
            <div className="flex h-full overflow-hidden">
              {/* Image Section - 2/3 width */}
              <div className="w-2/3 flex-shrink-0 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center p-6 overflow-auto">
                {selectedAvatar.imageUrl ? (
                  <img
                    src={selectedAvatar.imageUrl}
                    alt={`Avatar ${selectedAvatar.id}`}
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-zinc-500">No image available</p>
                  </div>
                )}
              </div>

              {/* Prompt Section - 1/3 width */}
              <div className="w-1/3 flex-shrink-0 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-auto p-6 flex flex-col">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    Prompt
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSave}
                      disabled={isSaving || !editedPrompt || JSON.stringify(editedPrompt) === JSON.stringify(selectedAvatar.prompt)}
                      className="flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {isSaving ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerate}
                      disabled={isRegenerating}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      {isRegenerating ? "Regenerating..." : "Regenerate"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="flex items-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      {isDeleting ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto">
                  {editedPrompt && (
                    <EditablePrompt
                      prompt={editedPrompt}
                      onChange={setEditedPrompt}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

