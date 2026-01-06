"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateProductCTAs, updateProduct } from "@/actions/products";
import { Loader2, Sparkles, Plus, X, Check, ArrowLeft } from "lucide-react";

interface ProductCTAsStepProps {
  productId: string;
  productTitle: string;
  productDescription?: string;
  onComplete: () => void;
  onBack: () => void;
}

export function ProductCTAsStep({
  productId,
  productTitle,
  productDescription,
  onComplete,
  onBack,
}: ProductCTAsStepProps) {
  const [ctas, setCTAs] = useState<string[]>([]);
  const [newCTA, setNewCTA] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateCTAs = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateProductCTAs({
        title: productTitle,
        description: productDescription,
      });
      setCTAs(result.ctas);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate CTAs");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddCTA = () => {
    if (newCTA.trim()) {
      setCTAs([...ctas, newCTA.trim()]);
      setNewCTA("");
    }
  };

  const handleRemoveCTA = (index: number) => {
    setCTAs(ctas.filter((_, i) => i !== index));
  };

  const handleUpdateCTA = (index: number, value: string) => {
    const updatedCTAs = [...ctas];
    updatedCTAs[index] = value;
    setCTAs(updatedCTAs);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await updateProduct({
        id: productId,
        ctas: ctas.filter((c) => c.trim().length > 0),
      });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save CTAs");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = async () => {
    setIsSaving(true);
    try {
      // Save with empty ctas array
      await updateProduct({
        id: productId,
        ctas: [],
      });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={isSaving}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h3 className="text-sm font-medium">Add CTAs for Your Product</h3>
          <p className="text-xs text-muted-foreground">
            CTAs (Call to Actions) are compelling phrases that drive viewers to take action
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Generate Button */}
      <Button
        onClick={handleGenerateCTAs}
        disabled={isGenerating || isSaving}
        variant="outline"
        className="w-full"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating CTAs...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate CTAs with AI
          </>
        )}
      </Button>

      {/* CTAs List */}
      {ctas.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Generated CTAs</label>
          <div className="space-y-2">
            {ctas.map((cta, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={cta}
                  onChange={(e) => handleUpdateCTA(index, e.target.value)}
                  disabled={isSaving}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveCTA(index)}
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

      {/* Add Manual CTA */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Add CTA Manually</label>
        <div className="flex items-center gap-2">
          <Input
            value={newCTA}
            onChange={(e) => setNewCTA(e.target.value)}
            placeholder="Enter a CTA..."
            disabled={isSaving}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddCTA();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAddCTA}
            disabled={isSaving || !newCTA.trim()}
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
          onClick={handleSkip}
          disabled={isSaving}
          className="flex-1"
        >
          Skip for Now
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving || ctas.length === 0}
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
              Save Product
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

