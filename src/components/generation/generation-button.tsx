"use client";

import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export interface GenerationStatus {
  isComplete: boolean;
  imageUrl?: string | null;
  [key: string]: any; // Allow additional status fields
}

export interface GenerationButtonProps {
  /** Server action to start the generation. Should return an object with an `id` field. */
  onStart: () => Promise<{ id: string; [key: string]: any }>;
  /** Server action to check generation status. Takes an id and returns status. */
  onCheckStatus: (id: string) => Promise<GenerationStatus>;
  /** Text for the button when idle */
  buttonText?: string;
  /** Text for the button when starting */
  startingText?: string;
  /** Text for the button when polling */
  pollingText?: string;
  /** Message shown while polling */
  pollingMessage?: string;
  /** Custom render function for the result. Receives the status object. */
  renderResult?: (status: GenerationStatus) => React.ReactNode;
  /** Polling interval in milliseconds (default: 2000) */
  pollInterval?: number;
  /** Additional className for the container */
  className?: string;
}

export function GenerationButton({
  onStart,
  onCheckStatus,
  buttonText = "Generate",
  startingText = "Starting generation...",
  pollingText = "Generating...",
  pollingMessage = "Generation in progress... This may take a minute.",
  renderResult,
  pollInterval = 2000,
  className = "",
}: GenerationButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [itemId, setItemId] = useState<string | null>(null);
  const [status, setStatus] = useState<GenerationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Poll for completion
  useEffect(() => {
    if (!itemId || !isPolling) return;

    const pollIntervalId = setInterval(async () => {
      try {
        const currentStatus = await onCheckStatus(itemId);
        setStatus(currentStatus);
        
        if (currentStatus.isComplete) {
          setIsPolling(false);
          clearInterval(pollIntervalId);
        }
      } catch (err) {
        console.error("Error polling status:", err);
        setError(err instanceof Error ? err.message : "Failed to check status");
        setIsPolling(false);
        clearInterval(pollIntervalId);
      }
    }, pollInterval);

    return () => clearInterval(pollIntervalId);
  }, [itemId, isPolling, onCheckStatus, pollInterval]);

  async function handleClick() {
    setIsLoading(true);
    setError(null);
    setStatus(null);
    setItemId(null);
    
    try {
      const result = await onStart();
      setItemId(result.id);
      setIsPolling(true);
      setIsLoading(false); // Stop loading, start polling
    } catch (err) {
      console.error("Error starting generation:", err);
      setError(err instanceof Error ? err.message : "Failed to start generation");
      setIsLoading(false);
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <Button 
        onClick={handleClick} 
        disabled={isLoading || isPolling}
      >
        {isLoading 
          ? startingText
          : isPolling 
          ? pollingText
          : buttonText}
      </Button>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
          Error: {error}
        </div>
      )}

      {isPolling && !status?.isComplete && (
        <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
          {pollingMessage}
        </div>
      )}

      {status?.isComplete && (
        <div className="space-y-2">
          {renderResult ? (
            renderResult(status)
          ) : status.imageUrl ? (
            <>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                Generation completed successfully!
              </p>
              <div className="rounded-lg border border-zinc-200 overflow-hidden dark:border-zinc-800">
                <img 
                  src={status.imageUrl} 
                  alt="Generated result" 
                  className="w-full h-auto"
                />
              </div>
            </>
          ) : (
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              Generation completed successfully!
            </p>
          )}
        </div>
      )}
    </div>
  );
}

