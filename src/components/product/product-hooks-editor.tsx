"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateProductHooks, updateProduct } from "@/actions/products";
import { Loader2, Sparkles, Plus, X, Check } from "lucide-react";

interface ProductHooksEditorProps {
  productId: string;
  productTitle: string;
  productDescription?: string;
  initialHooks?: string[];
  onSave: (updatedProduct: {
    id: string;
    type: "external" | "custom";
    sourceUrl: string | null;
    title: string | null;
    description: string | null;
    price: number | null;
    images: string[];
    hooks: string[];
    parsed: boolean;
    error: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) => void;
  onCancel: () => void;
}

export function ProductHooksEditor({
  productId,
  productTitle,
  productDescription,
  initialHooks = [],
  onSave,
  onCancel,
}: ProductHooksEditorProps) {
  const [hooks, setHooks] = useState<string[]>(initialHooks);
  const [newHook, setNewHook] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousProductIdRef = useRef<string | null>(null);

  // Only sync hooks when productId changes (different product)
  // This prevents resetting hooks when the parent updates after save
  // On initial mount, useState already initializes with initialHooks
  useEffect(() => {
    if (previousProductIdRef.current === null) {
      // Initial mount - just track the productId
      previousProductIdRef.current = productId;
    } else if (previousProductIdRef.current !== productId) {
      // Product changed - sync hooks
      previousProductIdRef.current = productId;
      setHooks(initialHooks);
    }
    // If productId is the same, don't update hooks (user might be editing)
  }, [productId, initialHooks]);

  const handleGenerateHooks = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateProductHooks({
        title: productTitle,
        description: productDescription,
      });
      setHooks(result.hooks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate hooks");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddHook = () => {
    if (newHook.trim()) {
      setHooks([...hooks, newHook.trim()]);
      setNewHook("");
    }
  };

  const handleRemoveHook = (index: number) => {
    setHooks(hooks.filter((_, i) => i !== index));
  };

  const handleUpdateHook = (index: number, value: string) => {
    const updatedHooks = [...hooks];
    updatedHooks[index] = value;
    setHooks(updatedHooks);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateProduct({
        id: productId,
        hooks: hooks.filter((h) => h.trim().length > 0),
      });
      onSave(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save hooks");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Edit Hooks</h3>
        <p className="text-xs text-muted-foreground">
          Hooks are attention-grabbing opening lines for TikTok Shop videos
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Generate Button */}
      <Button
        onClick={handleGenerateHooks}
        disabled={isGenerating || isSaving}
        variant="outline"
        className="w-full"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating hooks...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate Hooks with AI
          </>
        )}
      </Button>

      {/* Hooks List */}
      {hooks.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Hooks</label>
          <div className="space-y-2">
            {hooks.map((hook, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={hook}
                  onChange={(e) => handleUpdateHook(index, e.target.value)}
                  disabled={isSaving}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveHook(index)}
                  disabled={isSaving}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Manual Hook */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Add Hook Manually</label>
        <div className="flex items-center gap-2">
          <Input
            value={newHook}
            onChange={(e) => setNewHook(e.target.value)}
            placeholder="Enter a hook..."
            disabled={isSaving}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddHook();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAddHook}
            disabled={isSaving || !newHook.trim()}
            className="shrink-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-4">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Save Hooks
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

