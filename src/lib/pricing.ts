// Gemini API pricing per model (last verified 2026-04-06)
// https://ai.google.dev/gemini-api/docs/pricing

export const MODEL_PRICING: Record<
  string,
  { inputPerMillion: number; outputPerImage: number }
> = {
  "nano-banana-pro": {
    // gemini-3-pro-image-preview (deprecated 2026-03-09)
    inputPerMillion: 2.0,
    outputPerImage: 0.134, // ~1K resolution
  },
  "nano-banana-2": {
    // gemini-3.1-flash-image-preview
    inputPerMillion: 0.5,
    outputPerImage: 0.067, // 1K resolution
  },
  "imagen-4": {
    // imagen-4.0-generate-001 (no token input cost)
    inputPerMillion: 0,
    outputPerImage: 0.067, // 1K resolution
  },
};

const DEFAULT_PRICING = MODEL_PRICING["nano-banana-2"];

export function calculateGenerationCost(
  model: string | undefined,
  promptTokens: number | undefined | null,
  imageCount: number
): number {
  const pricing = (model && MODEL_PRICING[model]) || DEFAULT_PRICING;
  const inputCost = promptTokens
    ? (promptTokens / 1_000_000) * pricing.inputPerMillion
    : 0;
  const outputCost = imageCount * pricing.outputPerImage;
  return inputCost + outputCost;
}
