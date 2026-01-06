import { z } from "zod";
import type { VideoGenerationPlan, DirectorInput } from "@/types/video-generation";

const PlanSchema = z.object({
  productInteraction: z.enum(["handheld", "non-handheld"]),
  interactionReasoning: z.string().min(10),
  imageGeneration: z.array(
    z.object({
      compositeId: z.string(),
      avatarSource: z.string(),
      productSources: z.array(z.string()),
      prompt: z.string().min(20),
      description: z.string().min(10),
    })
  ),
  totalDuration: z.union([z.literal(16), z.literal(20), z.literal(24)]),
  segments: z.array(
    z.object({
      segmentIndex: z.number(),
      veoCallId: z.string().nullable(),
      startTime: z.number(),
      endTime: z.number(),
      type: z.enum(["talking_head", "demo_broll", "product_broll", "virtual_broll"]),
      script: z.string().optional(),
      setting: z.string().optional(),
      action: z.string().optional(),
      demoId: z.string().optional(),
      demoTimestamp: z.tuple([z.number(), z.number()]).optional(),
      overlayTalkingHead: z.boolean().optional(),
      productImageIndex: z.number().optional(),
      brollPrompt: z.string().optional(),
      existingClipId: z.string().optional(),
    })
  ),
  veoCalls: z.array(
    z.object({
      callId: z.string(),
      sourceImageType: z.enum(["avatar", "composite", "product"]),
      sourceImageRef: z.string(),
      prompt: z.string().min(50),
    })
  ),
  clips: z.array(
    z.object({
      clipId: z.string(),
      veoCallId: z.string(),
      startTime: z.number().min(0).max(8),
      endTime: z.number().min(0).max(8),
      order: z.number().int().min(0),
    })
  ),
});

export function validatePlan(
  plan: VideoGenerationPlan,
  input: DirectorInput
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Normalize and fix common issues before validation
  if (plan.veoCalls) {
    for (const veoCall of plan.veoCalls) {
      // Normalize sourceImageType to lowercase and fix common variations
      if (typeof veoCall.sourceImageType === "string") {
        const normalized = veoCall.sourceImageType.toLowerCase().trim();
        if (normalized === "avatar" || normalized === "composite" || normalized === "product") {
          veoCall.sourceImageType = normalized as "avatar" | "composite" | "product";
        } else {
          // Try to infer from sourceImageRef
          if (veoCall.sourceImageRef?.toUpperCase().startsWith("AVATAR")) {
            veoCall.sourceImageType = "avatar";
          } else if (veoCall.sourceImageRef?.toLowerCase().startsWith("composite")) {
            veoCall.sourceImageType = "composite";
          } else if (veoCall.sourceImageRef?.toUpperCase().startsWith("PRODUCT")) {
            veoCall.sourceImageType = "product";
          } else {
            errors.push(`Invalid sourceImageType "${veoCall.sourceImageType}" for veoCall ${veoCall.callId}. Expected one of "avatar"|"composite"|"product". sourceImageRef: ${veoCall.sourceImageRef}`);
          }
        }
      }
    }
  }

  // Schema validation
  const schemaResult = PlanSchema.safeParse(plan);
  if (!schemaResult.success) {
    errors.push(
      ...schemaResult.error.issues.map((e) =>
        `${e.path.join(".")}: ${e.message}`
      )
    );
    return { valid: false, errors, warnings };
  }

  // Semantic validation

  // Check for brollVeoCallId references and ensure they exist in veoCalls
  const veoCallIdsSet = new Set(plan.veoCalls.map((v) => v.callId));
  for (const segment of plan.segments) {
    if (segment.brollVeoCallId && !veoCallIdsSet.has(segment.brollVeoCallId)) {
      errors.push(`Segment ${segment.segmentIndex} references non-existent brollVeoCallId: ${segment.brollVeoCallId}`);
    }
  }

  // Check Veo call count
    const overlayCount = plan.segments.filter(s => s.overlayTalkingHead).length;
    const baseExpectedCalls = Math.ceil(plan.totalDuration / 8);
    const maxAllowedCalls = baseExpectedCalls + overlayCount;

    if (plan.veoCalls.length > maxAllowedCalls) {
    errors.push(`Too many Veo calls: ${plan.veoCalls.length}. Max allowed for ${plan.totalDuration}s with ${overlayCount} overlay talking heads is ${maxAllowedCalls}`);
    }

  // Check composite references
  const compositeIds = new Set(plan.imageGeneration.map((ig) => ig.compositeId));
  for (const veoCall of plan.veoCalls) {
    if (veoCall.sourceImageType === "composite" && !compositeIds.has(veoCall.sourceImageRef)) {
      errors.push(`Veo call references non-existent composite: ${veoCall.sourceImageRef}`);
    }
  }

  // Check product image indices
  for (const task of plan.imageGeneration) {
    for (const ref of task.productSources) {
      const index = parseInt(ref.split("_")[1]) - 1;
      if (index >= input.product.images.length) {
        errors.push(`Invalid product image reference: ${ref}`);
      }
    }
  }

  // Check demo references
  const demoIds = new Set(input.demos.map((d) => d.id));
  for (const segment of plan.segments) {
    if (segment.type === "demo_broll" && segment.demoId && !demoIds.has(segment.demoId)) {
      errors.push(`Invalid demo reference: ${segment.demoId}`);
    }
  }

  // Check existing clip references
  const existingClipIds = new Set(input.existingClips.map((c) => c.id));
  for (const segment of plan.segments) {
    if (segment.existingClipId && !existingClipIds.has(segment.existingClipId)) {
      errors.push(`Invalid existing clip reference: ${segment.existingClipId}`);
    }
  }

  // Check talking_head segments have scripts
  for (const segment of plan.segments) {
    if (segment.type === "talking_head" && !segment.script) {
      errors.push(`Talking head segment ${segment.segmentIndex} missing script`);
    }
  }

  // Check handheld products have composites
  if (plan.productInteraction === "handheld" && plan.imageGeneration.length === 0) {
    errors.push("Handheld product requires at least one composite image");
  }

  // Check clips reference valid Veo calls
  const veoCallIdsForClips = new Set(plan.veoCalls.map((v) => v.callId));
  for (const clip of plan.clips) {
    if (!veoCallIdsForClips.has(clip.veoCallId)) {
      errors.push(`Clip ${clip.clipId} references non-existent Veo call: ${clip.veoCallId}`);
    }
    if (clip.startTime >= clip.endTime) {
      errors.push(`Clip ${clip.clipId} has invalid time range: startTime (${clip.startTime}) must be less than endTime (${clip.endTime})`);
    }
    if (clip.endTime > 8) {
      errors.push(`Clip ${clip.clipId} has endTime (${clip.endTime}) greater than 8 seconds`);
    }
  }

  // Check clips cover the total duration
  const totalClipDuration = plan.clips.reduce((sum, clip) => sum + (clip.endTime - clip.startTime), 0);
  if (Math.abs(totalClipDuration - plan.totalDuration) > 0.5) {
    warnings.push(`Total clip duration (${totalClipDuration}s) doesn't match totalDuration (${plan.totalDuration}s)`);
  }

  // Check clip order is sequential
  const sortedClips = [...plan.clips].sort((a, b) => a.order - b.order);
  for (let i = 0; i < sortedClips.length; i++) {
    if (sortedClips[i].order !== i) {
      warnings.push(`Clip order is not sequential: expected order ${i}, found ${sortedClips[i].order}`);
    }
  }

  // Warnings for script pacing
  for (const segment of plan.segments) {
    if (segment.script) {
      const duration = segment.endTime - segment.startTime;
      const wordCount = segment.script.split(/\s+/).length;
      const wps = wordCount / duration;

      if (wps > 4)
        warnings.push(`Segment ${segment.segmentIndex} script may be too fast: ${wps.toFixed(1)} words/sec`);
      if (wps < 1.5)
        warnings.push(`Segment ${segment.segmentIndex} script may be too slow: ${wps.toFixed(1)} words/sec`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

