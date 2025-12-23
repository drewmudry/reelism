"use client";

import { MediaModal } from "@/components/ui/media-modal";

interface Animation {
  id: string;
  videoUrl: string | null;
  prompt: string;
  avatarId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AnimationListModalProps {
  animation: Animation;
  onClose: () => void;
}

export function AnimationListModal({ animation, onClose }: AnimationListModalProps) {
  return (
    <MediaModal
      mediaType="video"
      mediaUrl={animation.videoUrl}
      isLoading={!animation.videoUrl}
      loadingText="Generating animation..."
      loadingSubtext="This may take a few minutes"
      onClose={onClose}
      showCopyButtons={false}
      showDownloadButton={true}
    />
  );
}
