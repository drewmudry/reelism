/**
 * Remix Options - Granular control for avatar remixing
 *
 * These options provide fine-grained control over how an avatar is remixed,
 * allowing users to specify intensity, preserved elements, and style preferences.
 */

/**
 * How much the remix should deviate from the original image
 */
export type RemixIntensity = 'subtle' | 'moderate' | 'dramatic';

/**
 * Elements to preserve during the remix
 */
export type PreserveElement = 'face' | 'clothing' | 'background' | 'pose' | 'lighting' | 'colors';

/**
 * Style preset for quick styling options
 */
export type StylePreset =
  | 'none'           // No style change
  | 'cinematic'      // Movie-like lighting and composition
  | 'vibrant'        // Bright, saturated colors
  | 'moody'          // Dark, atmospheric
  | 'soft'           // Soft lighting, dreamy
  | 'professional'   // Clean, professional look
  | 'artistic'       // Creative, artistic interpretation
  | 'vintage';       // Retro, nostalgic feel

/**
 * Complete remix options configuration
 */
export interface RemixOptions {
  /**
   * How much the remix should deviate from the original
   * - subtle: Minor tweaks, stays very close to original
   * - moderate: Noticeable changes while maintaining essence
   * - dramatic: Significant transformation
   * @default 'moderate'
   */
  intensity: RemixIntensity;

  /**
   * Elements to preserve unchanged during the remix
   * @default []
   */
  preserveElements: PreserveElement[];

  /**
   * Style preset to apply
   * @default 'none'
   */
  stylePreset: StylePreset;

  /**
   * Number of variation to generate (for future multi-generation support)
   * Currently only 1 is supported
   * @default 1
   */
  variationCount: number;
}

/**
 * Default remix options
 */
export const DEFAULT_REMIX_OPTIONS: RemixOptions = {
  intensity: 'moderate',
  preserveElements: [],
  stylePreset: 'none',
  variationCount: 1,
};

/**
 * Display labels for remix intensity
 */
export const INTENSITY_LABELS: Record<RemixIntensity, { label: string; description: string }> = {
  subtle: {
    label: 'Subtle',
    description: 'Minor adjustments, stays close to original',
  },
  moderate: {
    label: 'Moderate',
    description: 'Balanced changes while keeping the essence',
  },
  dramatic: {
    label: 'Dramatic',
    description: 'Significant transformation of the image',
  },
};

/**
 * Display labels for preserve elements
 */
export const PRESERVE_ELEMENT_LABELS: Record<PreserveElement, { label: string; description: string }> = {
  face: {
    label: 'Face',
    description: 'Keep facial features unchanged',
  },
  clothing: {
    label: 'Clothing',
    description: 'Preserve current outfit',
  },
  background: {
    label: 'Background',
    description: 'Keep the background environment',
  },
  pose: {
    label: 'Pose',
    description: 'Maintain body position and posture',
  },
  lighting: {
    label: 'Lighting',
    description: 'Keep current lighting style',
  },
  colors: {
    label: 'Color Palette',
    description: 'Preserve the color scheme',
  },
};

/**
 * Display labels for style presets
 */
export const STYLE_PRESET_LABELS: Record<StylePreset, { label: string; description: string }> = {
  none: {
    label: 'None',
    description: 'No style modification',
  },
  cinematic: {
    label: 'Cinematic',
    description: 'Movie-like lighting and composition',
  },
  vibrant: {
    label: 'Vibrant',
    description: 'Bright, saturated colors',
  },
  moody: {
    label: 'Moody',
    description: 'Dark, atmospheric feel',
  },
  soft: {
    label: 'Soft',
    description: 'Soft lighting, dreamy look',
  },
  professional: {
    label: 'Professional',
    description: 'Clean, polished appearance',
  },
  artistic: {
    label: 'Artistic',
    description: 'Creative interpretation',
  },
  vintage: {
    label: 'Vintage',
    description: 'Retro, nostalgic aesthetic',
  },
};

/**
 * Build an enhanced prompt incorporating remix options
 */
export function buildRemixPrompt(
  baseInstructions: string,
  options: RemixOptions
): string {
  const parts: string[] = [];

  // Add intensity context
  switch (options.intensity) {
    case 'subtle':
      parts.push('Make very subtle, minimal changes to the image.');
      break;
    case 'moderate':
      parts.push('Make moderate changes while preserving the overall feel.');
      break;
    case 'dramatic':
      parts.push('Make dramatic, significant changes to transform the image.');
      break;
  }

  // Add base instructions
  parts.push(baseInstructions);

  // Add preservation instructions
  if (options.preserveElements.length > 0) {
    const preserveList = options.preserveElements
      .map(el => PRESERVE_ELEMENT_LABELS[el].label.toLowerCase())
      .join(', ');
    parts.push(`IMPORTANT: Keep these elements unchanged: ${preserveList}.`);
  }

  // Add style preset instructions
  if (options.stylePreset !== 'none') {
    const styleInstructions: Record<Exclude<StylePreset, 'none'>, string> = {
      cinematic: 'Apply cinematic lighting with dramatic shadows, film-like color grading, and professional composition.',
      vibrant: 'Use bright, vivid, saturated colors with high energy and visual impact.',
      moody: 'Create a dark, atmospheric mood with deep shadows and muted tones.',
      soft: 'Apply soft, diffused lighting with a dreamy, ethereal quality.',
      professional: 'Create a clean, polished look suitable for professional use with even lighting.',
      artistic: 'Apply creative, artistic interpretation with unique visual elements.',
      vintage: 'Add a retro, nostalgic feel with warm tones and film grain texture.',
    };
    parts.push(styleInstructions[options.stylePreset]);
  }

  return parts.join(' ');
}
