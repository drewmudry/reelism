"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export type TalkingHeadRegion = {
  x: number; // X position as percentage (0-100)
  y: number; // Y position as percentage (0-100)
  width: number; // Width as percentage (0-100)
  height: number; // Height as percentage (0-100)
  startTime?: number; // Optional: start time in seconds
  endTime?: number; // Optional: end time in seconds
};

interface VideoRegionSelectorProps {
  videoUrl: string;
  regions: TalkingHeadRegion[];
  onRegionsChange: (regions: TalkingHeadRegion[]) => void;
  isRequired?: boolean;
  showSidePanel?: boolean; // Whether to show side panel inline or return it separately
  onSidePanelRender?: (panel: React.ReactNode) => void; // Callback to render side panel outside
}

export function VideoRegionSelector({
  videoUrl,
  regions,
  onRegionsChange,
  isRequired = false,
  showSidePanel = true,
  onSidePanelRender,
}: VideoRegionSelectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentRegion, setCurrentRegion] = useState<Partial<TalkingHeadRegion> | null>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setVideoDimensions({
        width: video.videoWidth,
        height: video.videoHeight,
      });
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    return () => video.removeEventListener("loadedmetadata", handleLoadedMetadata);
  }, []);

  const getRelativePosition = (clientX: number, clientY: number) => {
    if (!containerRef.current || !videoDimensions) return null;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    const pos = getRelativePosition(e.clientX, e.clientY);
    if (!pos) return;

    setIsDrawing(true);
    setStartPos(pos);
    setCurrentRegion({ x: pos.x, y: pos.y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !startPos) return;
    const pos = getRelativePosition(e.clientX, e.clientY);
    if (!pos) return;

    const width = pos.x - startPos.x;
    const height = pos.y - startPos.y;

    setCurrentRegion({
      x: width < 0 ? pos.x : startPos.x,
      y: height < 0 ? pos.y : startPos.y,
      width: Math.abs(width),
      height: Math.abs(height),
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !startPos || !currentRegion) {
      setIsDrawing(false);
      setStartPos(null);
      setCurrentRegion(null);
      return;
    }

    // Only add region if it has minimum size
    if (currentRegion.width! > 2 && currentRegion.height! > 2) {
      const newRegion: TalkingHeadRegion = {
        x: currentRegion.x!,
        y: currentRegion.y!,
        width: currentRegion.width!,
        height: currentRegion.height!,
      };
      onRegionsChange([...regions, newRegion]);
    }

    setIsDrawing(false);
    setStartPos(null);
    setCurrentRegion(null);
  };

  const removeRegion = (index: number) => {
    onRegionsChange(regions.filter((_, i) => i !== index));
  };

  // Side panel component
  const sidePanel = regions.length > 0 ? (
    <div className="w-[320px] bg-card rounded-lg shadow-2xl border border-zinc-200 dark:border-zinc-800 p-4 overflow-y-auto max-h-[500px]">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Selected Regions ({regions.length})
        </h3>
      </div>
      <div className="space-y-2">
        {regions.map((region, index) => (
          <div
            key={index}
            className="flex items-start justify-between p-3 bg-muted rounded-lg text-sm hover:bg-muted/80 transition-colors"
          >
            <div className="flex-1">
              <div className="font-medium mb-1">Region {index + 1}</div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>
                  Position: ({region.x.toFixed(1)}%, {region.y.toFixed(1)}%)
                </div>
                <div>
                  Size: {region.width.toFixed(1)}% × {region.height.toFixed(1)}%
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeRegion(index)}
              className="h-8 w-8 p-0 flex-shrink-0"
              title="Remove region"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  // If onSidePanelRender is provided, call it with the side panel
  useEffect(() => {
    if (onSidePanelRender) {
      onSidePanelRender(sidePanel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions.length, onSidePanelRender]);

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className="relative overflow-hidden bg-black w-full"
        style={{ aspectRatio: videoDimensions ? videoDimensions.width / videoDimensions.height : 9 / 16 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain"
          controls
          muted
          playsInline
          preload="metadata"
        />

          {/* Existing regions */}
          {regions.map((region, index) => (
            <div
              key={index}
              className="absolute border-2 border-blue-500 bg-blue-500/20 cursor-pointer hover:bg-blue-500/30 transition-colors"
              style={{
                left: `${region.x}%`,
                top: `${region.y}%`,
                width: `${region.width}%`,
                height: `${region.height}%`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                removeRegion(index);
              }}
              title="Click to remove"
            >
              <div className="absolute -top-6 left-0 text-xs text-blue-500 font-medium bg-black/50 px-1 rounded">
                Region {index + 1}
              </div>
            </div>
          ))}

          {/* Current drawing region */}
          {currentRegion && currentRegion.width! > 0 && currentRegion.height! > 0 && (
            <div
              className="absolute border-2 border-dashed border-yellow-500 bg-yellow-500/10 pointer-events-none"
              style={{
                left: `${currentRegion.x}%`,
                top: `${currentRegion.y}%`,
                width: `${currentRegion.width}%`,
                height: `${currentRegion.height}%`,
              }}
            />
          )}

          {/* Helper text when no regions */}
          {regions.length === 0 && !isDrawing && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/70 text-white px-4 py-2 rounded-lg text-sm">
                Click and drag to select regions
              </div>
            </div>
          )}
        </div>
    </div>
  );
}

