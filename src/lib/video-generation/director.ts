import { generateTextPro } from "@/lib/ai";
import type { DirectorInput, VideoGenerationPlan } from "@/types/video-generation";
import { DIRECTOR_PROMPT } from "./director-prompt";

export async function callDirector(input: DirectorInput): Promise<VideoGenerationPlan> {
  // Build the prompt with inputs
  const prompt = buildPrompt(input);

  // Use generateTextPro from ai.ts
  const response = await generateTextPro(prompt, {
    maxOutputTokens: 4096,
    temperature: 0.7,
  });

  // Extract JSON from response
  const plan = extractJson(response.text);
  return plan as VideoGenerationPlan;
}

function buildPrompt(input: DirectorInput): string {
  let prompt = DIRECTOR_PROMPT;

  // Replace placeholders
  prompt = prompt.replace("{{product.name}}", input.product.name);
  prompt = prompt.replace("{{product.price}}", input.product.price?.toString() || "N/A");
  prompt = prompt.replace("{{product.description}}", input.product.description || "No description");
  prompt = prompt.replace("{{product.hooks}}", JSON.stringify(input.product.hooks));
  prompt = prompt.replace("{{preferences.tone}}", input.preferences.tone);
  // Director chooses duration (16-24 seconds) - no need to replace placeholder
  prompt = prompt.replace("{{preferences.targetDuration}}", "16-24 seconds (you choose optimal duration)");

  // Build demos section
  const demosSection =
    input.demos.length > 0
      ? input.demos.map((d, i) => `- Demo ${i + 1}: ${d.description || "No description"} (ID: ${d.id})`).join("\n")
      : "No demo footage available.";
  prompt = prompt.replace("{{demos}}", demosSection);

  // Build existing clips section
  const clipsSection =
    input.existingClips.length > 0
      ? input.existingClips.map((c) => `- ${c.id}: ${c.description} (${c.duration}s, ${c.type})`).join("\n")
      : "No existing clips available.";
  prompt = prompt.replace("{{existingClips}}", clipsSection);

  return prompt;
}

function extractJson(text: string): unknown {
  // Try markdown code block first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim());
  }

  // Try raw JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  throw new Error("Could not extract JSON from director response");
}


