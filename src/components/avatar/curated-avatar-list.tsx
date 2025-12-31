"use client";

import { useState, useEffect } from "react";
import { remixAvatar } from "@/actions/generate-avatar";
import { useRouter } from "next/navigation";
import { AvatarListModal } from "./avatar-list-modal";
import { Loader2 } from "lucide-react";

interface CuratedAvatar {
  id: string;
  imageUrl: string | null;
  prompt: any;
  createdAt: Date;
  updatedAt: Date;
}

export function CuratedAvatarList({
  avatars: initialAvatars,
  onSwitchToAllTab,
}: {
  avatars: CuratedAvatar[];
  onSwitchToAllTab?: () => void;
}) {
  const [selectedAvatar, setSelectedAvatar] = useState<CuratedAvatar | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const router = useRouter();

  // Poll for completed avatars if there are any generating
  useEffect(() => {
    const hasGeneratingAvatars = initialAvatars.some((avatar) => !avatar.imageUrl);

    if (!hasGeneratingAvatars) return;

    const interval = setInterval(() => {
      router.refresh();
    }, 3000); // Refresh every 3 seconds

    return () => clearInterval(interval);
  }, [initialAvatars, router]);

  async function handleAvatarClick(avatar: CuratedAvatar) {
    setSelectedAvatar(avatar);
  }

  async function handleRemix(avatarId: string, instructions: string, productImageUrl?: string) {
    if (!instructions.trim()) return;

    setIsGenerating(true);
    try {
      await remixAvatar(avatarId, instructions.trim(), productImageUrl);
      // Close modal, switch to all tab, and refresh
      setSelectedAvatar(null);
      if (onSwitchToAllTab) {
        onSwitchToAllTab();
      }
      router.refresh();
    } catch (error) {
      console.error("Error generating remix:", error);
      alert(error instanceof Error ? error.message : "Failed to generate remix");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-5 gap-4">
        {initialAvatars.map((avatar) => (
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
                <div className="aspect-[3/4] flex flex-col items-center justify-center gap-2 bg-zinc-200 dark:bg-zinc-800">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                  <p className="text-xs text-zinc-500 font-medium">Generating...</p>
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            </div>
          </div>
        ))}
      </div>

      {selectedAvatar && (
        <AvatarListModal
          avatar={selectedAvatar}
          onClose={() => setSelectedAvatar(null)}
          onRemix={handleRemix}
          isGenerating={isGenerating}
        />
      )}
    </>
  );
}

