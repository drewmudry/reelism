"use client";

import { GenerationButton } from "@/components/generation/generation-button";
import { startAvatarGeneration, getAvatarStatus } from "@/actions/generate-avatar";

export function GenerateAvatarButton() {
  return (
    <GenerationButton
      onStart={async () => {
        const result = await startAvatarGeneration();
        return { id: result.avatarId };
      }}
      onCheckStatus={getAvatarStatus}
      buttonText="Generate Avatar (Test)"
      startingText="Starting generation..."
      pollingText="Generating avatar..."
      pollingMessage="Avatar generation in progress... This may take a minute."
      renderResult={(status) => (
        <>
          <p className="text-sm font-medium text-green-600 dark:text-green-400">
            Avatar generated successfully!
          </p>
          {status.imageUrl && (
            <div className="rounded-lg border border-zinc-200 overflow-hidden dark:border-zinc-800">
              <img 
                src={status.imageUrl} 
                alt="Generated avatar" 
                className="w-full h-auto"
              />
            </div>
          )}
        </>
      )}
    />
  );
}

