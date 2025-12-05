"use client";

import { Button } from "@/components/ui/button";
import { generateAllAvatars } from "@/actions/generate-avatar";
import { useState } from "react";

export function GenerateAllAvatarsButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    total: number;
    successful: number;
    failed: number;
    results: Array<{
      index: number;
      success: boolean;
      generationId?: string;
      avatarId?: string;
      jobId?: string;
      error?: string;
    }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await generateAllAvatars();
      setResult(response);
    } catch (err) {
      console.error("Error generating all avatars:", err);
      setError(err instanceof Error ? err.message : "Failed to generate avatars");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button onClick={handleClick} disabled={isLoading}>
        {isLoading ? "Generating all avatars..." : "Generate All Avatars"}
      </Button>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
          Error: {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-200">
            <p className="font-medium">
              Generation started: {result.successful} successful, {result.failed} failed out of {result.total} total
            </p>
            <p className="mt-1 text-xs opacity-80">
              All jobs have been triggered. Avatars will be generated in the background.
            </p>
          </div>

          {result.failed > 0 && (
            <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
              <p className="font-medium">Failed generations:</p>
              <ul className="mt-1 list-disc list-inside space-y-1 text-xs">
                {result.results
                  .filter((r) => !r.success)
                  .map((r) => (
                    <li key={r.index}>
                      Prompt {r.index}: {r.error || "Unknown error"}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

