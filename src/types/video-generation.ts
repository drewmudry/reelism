// Director output structure
export type VideoGenerationPlan = {
  productInteraction: "handheld" | "non-handheld";
  interactionReasoning: string;

  imageGeneration: ImageGenerationTask[];

  totalDuration: 16 | 20 | 24;

  segments: VideoSegment[];
  veoCalls: VeoCall[];
  clips: VideoClip[];
};

export type ImageGenerationTask = {
  compositeId: string; // e.g., "composite_1"
  avatarSource: string; // e.g., "AVATAR_1"
  productSources: string[]; // e.g., ["PRODUCT_1", "PRODUCT_2"]
  prompt: string;
  description: string;
};

export type VideoSegment = {
  segmentIndex: number;
  veoCallId: string | null; // e.g., "veo_1", null for demo_broll
  startTime: number; // within the veo call
  endTime: number;
  type: "talking_head" | "demo_broll" | "product_broll" | "virtual_broll";

  // For talking_head
  script?: string;
  setting?: string;
  action?: string;

  // For demo_broll
  demoId?: string;
  demoTimestamp?: [number, number];
  overlayTalkingHead?: boolean;

  // For product_broll / virtual_broll
  productImageIndex?: number;
  brollPrompt?: string;
  existingClipId?: string; // if reusing an indexed clip
};

export type VeoCall = {
  callId: string; // e.g., "veo_1"
  sourceImageType: "avatar" | "composite" | "product";
  sourceImageRef: string; // e.g., "AVATAR_1", "composite_1", "PRODUCT_1"
  prompt: string;
};

export type VideoClip = {
  clipId: string; // e.g., "clip_1"
  veoCallId: string; // which Veo generation this clip comes from
  startTime: number; // start time within the Veo call (0-8)
  endTime: number; // end time within the Veo call (0-8)
  order: number; // order in the final video (0, 1, 2, ...)
};

// Input to the director
export type DirectorInput = {
  product: {
    id: string;
    name: string;
    price: number | null;
    description: string | null;
    hooks: string[];
    images: string[];
  };
  avatar: {
    id: string;
    imageUrl: string;
  };
  demos: {
    id: string;
    description: string | null;
  }[];
  existingClips: {
    id: string;
    description: string;
    duration: number;
    type: string;
  }[];
  preferences: {
    tone: string;
    targetDuration: 16 | 20 | 24;
  };
};

