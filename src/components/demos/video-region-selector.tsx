"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Check, User } from "lucide-react";

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

// Predefined grid zones for overlay placement
// 4x4 grid with each cell being 25% width and height
const GRID_ZONES = [
  // Row 1
  { id: "zone-1", label: "1", x: 0, y: 0, width: 25, height: 25 },
  { id: "zone-2", label: "2", x: 25, y: 0, width: 25, height: 25 },
  { id: "zone-3", label: "3", x: 50, y: 0, width: 25, height: 25 },
  { id: "zone-4", label: "4", x: 75, y: 0, width: 25, height: 25 },
  // Row 2
  { id: "zone-5", label: "5", x: 0, y: 25, width: 25, height: 25 },
  { id: "zone-6", label: "6", x: 25, y: 25, width: 25, height: 25 },
  { id: "zone-7", label: "7", x: 50, y: 25, width: 25, height: 25 },
  { id: "zone-8", label: "8", x: 75, y: 25, width: 25, height: 25 },
  // Row 3
  { id: "zone-9", label: "9", x: 0, y: 50, width: 25, height: 25 },
  { id: "zone-10", label: "10", x: 25, y: 50, width: 25, height: 25 },
  { id: "zone-11", label: "11", x: 50, y: 50, width: 25, height: 25 },
  { id: "zone-12", label: "12", x: 75, y: 50, width: 25, height: 25 },
  // Row 4
  { id: "zone-13", label: "13", x: 0, y: 75, width: 25, height: 25 },
  { id: "zone-14", label: "14", x: 25, y: 75, width: 25, height: 25 },
  { id: "zone-15", label: "15", x: 50, y: 75, width: 25, height: 25 },
  { id: "zone-16", label: "16", x: 75, y: 75, width: 25, height: 25 },
];

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
    if (video.readyState >= 1) {
      handleLoadedMetadata();
    }
    return () => video.removeEventListener("loadedmetadata", handleLoadedMetadata);
  }, []);

  // Check if a zone is selected
  const isZoneSelected = (zone: typeof GRID_ZONES[0]) => {
    return regions.some(
      (r) =>
        Math.abs(r.x - zone.x) < 1 &&
        Math.abs(r.y - zone.y) < 1 &&
        Math.abs(r.width - zone.width) < 1 &&
        Math.abs(r.height - zone.height) < 1
    );
  };

  // Toggle a zone selection
  const toggleZone = (zone: typeof GRID_ZONES[0]) => {
    if (isZoneSelected(zone)) {
      // Remove the zone
      onRegionsChange(
        regions.filter(
          (r) =>
            !(
              Math.abs(r.x - zone.x) < 1 &&
              Math.abs(r.y - zone.y) < 1 &&
              Math.abs(r.width - zone.width) < 1 &&
              Math.abs(r.height - zone.height) < 1
            )
        )
      );
    } else {
      // Add the zone
      onRegionsChange([
        ...regions,
        {
          x: zone.x,
          y: zone.y,
          width: zone.width,
          height: zone.height,
        },
      ]);
    }
  };

  const removeRegion = (index: number) => {
    onRegionsChange(regions.filter((_, i) => i !== index));
  };

  // Get display name for a region based on its position
  const getRegionName = (region: TalkingHeadRegion) => {
    const matchedZone = GRID_ZONES.find(
      (z) =>
        Math.abs(region.x - z.x) < 1 &&
        Math.abs(region.y - z.y) < 1 &&
        Math.abs(region.width - z.width) < 1 &&
        Math.abs(region.height - z.height) < 1
    );
    return matchedZone ? `Zone ${matchedZone.label}` : `Custom (${region.x.toFixed(0)}%, ${region.y.toFixed(0)}%)`;
  };

  // Side panel component
  const sidePanel = regions.length > 0 ? (
    <div className="w-[280px] bg-card rounded-lg shadow-2xl border border-zinc-200 dark:border-zinc-800 p-4 overflow-y-auto max-h-[500px]">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <User className="h-4 w-4 text-emerald-500" />
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Overlay Zones ({regions.length})
        </h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        AI talking head avatars can appear in these areas
      </p>
      <div className="space-y-2">
        {regions.map((region, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-sm"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="font-medium text-emerald-800 dark:text-emerald-200 text-xs">
                {getRegionName(region)}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeRegion(index)}
              className="h-7 w-7 p-0 flex-shrink-0 hover:bg-red-100 dark:hover:bg-red-900/30"
              title="Remove zone"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
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

        {/* Grid overlay with clickable zones */}
        <div className="absolute inset-0 pointer-events-none">
          {GRID_ZONES.map((zone) => {
            const isSelected = isZoneSelected(zone);
            return (
              <button
                key={zone.id}
                type="button"
                onClick={() => toggleZone(zone)}
                className={`absolute pointer-events-auto transition-all duration-200 flex items-center justify-center group ${
                  isSelected
                    ? "bg-emerald-500/30 border-2 border-emerald-500"
                    : "bg-transparent border border-white/20 hover:bg-white/10 hover:border-white/40"
                }`}
                style={{
                  left: `${zone.x}%`,
                  top: `${zone.y}%`,
                  width: `${zone.width}%`,
                  height: `${zone.height}%`,
                }}
                title={isSelected ? `Remove ${zone.label}` : `Allow overlay in ${zone.label}`}
              >
                {isSelected ? (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                      <span className="text-xs font-bold text-white">{zone.label}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-6 h-6 rounded-full bg-black/70 flex items-center justify-center group-hover:bg-black/90 transition-colors">
                      <span className="text-[10px] font-semibold text-white">{zone.label}</span>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
