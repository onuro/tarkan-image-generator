"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { GoogleGenAI } from "@google/genai";
import { Id } from "./_generated/dataModel";

const GEMINI_MODELS: Record<string, string> = {
  "imagen-4": "imagen-4.0-generate-001",
  "nano-banana-pro": "gemini-3-pro-image-preview",
  "nano-banana-2": "gemini-3.1-flash-image-preview",
  "nano-banana-og": "gemini-2.5-flash-image",
};

function hasVertexConfig(): boolean {
  // Vertex AI Express Mode (API key only) or full service account mode
  return !!process.env.GOOGLE_VERTEX_API_KEY ||
    !!(process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_CREDENTIALS);
}

function hasGeminiConfig(): boolean {
  return !!process.env.GOOGLE_AI_API_KEY;
}

function createGenAIClient(preferVertex?: boolean): GoogleGenAI {
  const vertexAvailable = hasVertexConfig();
  const geminiAvailable = hasGeminiConfig();

  const useVertex =
    preferVertex === true ? vertexAvailable :
    preferVertex === false ? !geminiAvailable && vertexAvailable :
    vertexAvailable; // default: Vertex takes priority (original behavior)

  if (useVertex && vertexAvailable) {
    // Vertex AI Express Mode
    if (process.env.GOOGLE_VERTEX_API_KEY) {
      return new GoogleGenAI({
        vertexai: true,
        apiKey: process.env.GOOGLE_VERTEX_API_KEY,
      });
    }
    // Full service account mode
    return new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT!,
      location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
      googleAuthOptions: {
        credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS!),
      },
    });
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Set GOOGLE_VERTEX_API_KEY (Vertex AI Express), or GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_CREDENTIALS (Vertex AI), or GOOGLE_AI_API_KEY (AI Studio). " +
        "Add them in the Convex dashboard under Settings > Environment Variables."
    );
  }
  return new GoogleGenAI({ apiKey });
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      const msg = e?.message || String(e);
      const isRateLimit = msg.includes('"code":429') || msg.includes("RESOURCE_EXHAUSTED");
      if (!isRateLimit || attempt === maxRetries) throw e;
      const delay = Math.pow(2, attempt) * 5000; // 5s, 10s, 20s
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Unreachable");
}

async function enhancePrompt(
  ai: GoogleGenAI,
  prompt: string
): Promise<string> {
  // Skip if prompt is already very detailed
  const wordCount = prompt.trim().split(/\s+/).length;
  if (wordCount >= 120) {
    return prompt;
  }

  const systemPrompt = `You are a world-class image generation prompt engineer with deep expertise in photography, cinematography, fine art, and visual storytelling. Your task is to transform simple prompts into richly detailed, production-ready image generation prompts.

RULES — follow every one:

1. PRESERVE INTENT: Keep ALL original subjects, objects, actions, and the core concept intact. Never remove, replace, or contradict anything the user described. The user's vision is sacred.

2. TARGET LENGTH: Expand the prompt to 80-150 words. Short prompts need the most expansion; longer ones need less. Never exceed 200 words.

3. ADD LAYERS OF DETAIL — enrich the prompt across these dimensions where relevant:
   - LIGHTING: Specify direction (rim, side, back, overhead), quality (hard, diffused, volumetric), color temperature (warm tungsten, cool daylight, mixed), and atmospheric effects (god rays, caustics, light shafts, ambient glow).
   - MATERIALS & TEXTURES: Describe surface qualities — roughness, reflectivity, translucency, patina, weave, grain, weathering. Be specific: "brushed matte aluminum with micro-scratches" not just "metal".
   - COMPOSITION & CAMERA: Suggest framing (close-up, medium shot, wide establishing), camera angle (low angle heroic, eye-level intimate, bird's eye), depth of field, leading lines, rule of thirds placement.
   - ATMOSPHERE & MOOD: Convey emotional tone through environmental cues — haze, dust motes, steam, rain droplets, time of day, season, weather conditions.
   - COLOR PALETTE: Define dominant and accent colors, contrast relationships, saturation levels, color harmony (complementary, analogous, triadic).
   - FINE DETAILS: Add small narrative-enhancing elements — subtle environmental storytelling, secondary objects, background elements that add depth without stealing focus.
   - TECHNICAL QUALITY: Reference camera bodies, lens characteristics, film stocks, rendering engines, or artistic techniques that establish the visual standard.

4. LOGICAL CONSISTENCY: Only add details that are physically and contextually plausible. Indoor scenes don't have horizons. Underwater scenes don't have dust. Night scenes don't have harsh sunlight. Think before you add.

5. CONCRETE LANGUAGE: Replace every vague adjective with a specific, evocative descriptor. "Beautiful sunset" → "molten amber and deep crimson sunset bleeding into indigo twilight with cirrus clouds catching the last magenta light". "Nice texture" → "hand-worn oak grain with deep honey-toned patina and hairline age cracks".

6. OUTPUT FORMAT: Return ONLY the enhanced prompt text. No quotes, no labels, no explanations, no preamble, no "Enhanced prompt:" prefix. Just the prompt itself.`;

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\nUser prompt: ${prompt}` }],
      },
    ],
    config: {
      maxOutputTokens: 2000,
    },
  }));

  const enhanced = response.candidates?.[0]?.content?.parts
    ?.filter((p) => p.text && !p.thought)
    ?.map((p) => p.text)
    ?.join("")
    ?.trim();

  // Safety: if enhancement returned empty or drastically shorter, fall back
  if (!enhanced || enhanced.length < prompt.length * 0.5) {
    return prompt;
  }

  return enhanced;
}

async function generateWithGemini(
  ai: GoogleGenAI,
  modelName: string,
  prompt: string,
  refImages: { base64: string; mimeType: string; label: string }[],
  thinkingBudget?: number,
  isVertex?: boolean
): Promise<{
  images: { imageBytes: string; mimeType: string }[];
  promptTokens: number;
}> {
  const parts: any[] = [{ text: prompt }];

  for (const ref of refImages) {
    parts.push({ text: `[Reference image ${ref.label}]` });
    parts.push({
      inlineData: {
        mimeType: ref.mimeType,
        data: ref.base64,
      },
    });
  }

  const config: any = {
    responseModalities: ["TEXT", "IMAGE"],
  };
  if (isVertex) {
    config.seed = Math.floor(Math.random() * 2 ** 31);
  }
  const supportsThinking = !modelName.includes("2.5-flash-image");
  if (thinkingBudget !== undefined && supportsThinking) {
    config.thinkingConfig = { thinkingBudget };
  }

  const response = await withRetry(() => ai.models.generateContent({
    model: modelName,
    contents: [{ role: "user", parts }],
    config,
  }));

  const promptTokens = response.usageMetadata?.promptTokenCount ?? 0;

  const images: { imageBytes: string; mimeType: string }[] = [];
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData?.data) {
        images.push({
          imageBytes: part.inlineData.data,
          mimeType: part.inlineData.mimeType || "image/png",
        });
      }
    }
  }
  return { images, promptTokens };
}

export const generate = action({
  args: {
    prompt: v.string(),
    originalPrompt: v.optional(v.string()),
    stylePreset: v.optional(v.string()),
    styleSuffix: v.optional(v.string()),
    aspectRatio: v.string(),
    numberOfImages: v.number(),
    referenceImageStorageIds: v.optional(v.array(v.id("_storage"))),
    keepReferenceIds: v.optional(v.array(v.id("_storage"))),
    enhancePrompt: v.optional(v.boolean()),
    thinkingLevel: v.optional(v.union(v.literal("low"), v.literal("high"))),
    model: v.optional(v.string()),
    provider: v.optional(v.union(v.literal("gemini"), v.literal("vertex"))),
  },
  returns: v.id("generations"),
  handler: async (ctx, args): Promise<Id<"generations">> => {
    const useVertex = args.provider === "vertex";
    const ai = createGenAIClient(args.provider ? useVertex : undefined);
    const selectedModel = args.model || "imagen-4";
    const modelName = GEMINI_MODELS[selectedModel] || GEMINI_MODELS["imagen-4"];
    const isImagen = selectedModel === "imagen-4";

    // Step 1: Optionally enhance the RAW user prompt (no style suffix)
    let enhancedPrompt = args.prompt;
    if (args.enhancePrompt) {
      enhancedPrompt = await enhancePrompt(ai, args.prompt);
    }

    // Step 2: Append style suffix AFTER enhancement
    let finalPrompt = enhancedPrompt;
    if (args.styleSuffix) {
      finalPrompt = `${enhancedPrompt}, ${args.styleSuffix}`;
    }

    // Get reference image data if provided
    const refImages: { base64: string; mimeType: string; label: string }[] = [];
    if (args.referenceImageStorageIds?.length) {
      for (let i = 0; i < args.referenceImageStorageIds.length; i++) {
        const refBlob = await ctx.storage.get(args.referenceImageStorageIds[i]);
        if (!refBlob) throw new Error(`Reference image @img${i + 1} not found in storage.`);
        const refBuffer = Buffer.from(await refBlob.arrayBuffer());
        refImages.push({
          base64: refBuffer.toString("base64"),
          mimeType: refBlob.type || "image/png",
          label: `@img${i + 1}`,
        });
      }
    }

    // Determine the actual model that will be used
    const actualModel =
      isImagen && refImages.length === 0
        ? "imagen-4"
        : isImagen
          ? "nano-banana-pro"
          : selectedModel;

    // Create the generation record upfront with empty images
    const generationId = await ctx.runMutation(internal.generations.create, {
      prompt: finalPrompt,
      originalPrompt: args.prompt,
      stylePreset: args.stylePreset,
      styleSuffix: args.styleSuffix,
      wasEnhanced: args.enhancePrompt || false,
      enhancedPrompt: args.enhancePrompt ? enhancedPrompt : undefined,
      aspectRatio: args.aspectRatio,
      numberOfImages: args.numberOfImages,
      imageStorageIds: [],
      model: actualModel,
      provider: args.provider,
      referenceImageStorageIds: args.keepReferenceIds,
      thinkingLevel: args.thinkingLevel,
    });

    try {
      if (isImagen && refImages.length === 0) {
        const aspectRatio = args.aspectRatio === "auto" ? "1:1" : args.aspectRatio;

        const response = await withRetry(() => ai.models.generateImages({
          model: modelName,
          prompt: finalPrompt,
          config: {
            numberOfImages: args.numberOfImages,
            aspectRatio,
          },
        }));

        if (response.generatedImages) {
          for (const generatedImage of response.generatedImages) {
            const imageBytes = generatedImage.image?.imageBytes;
            if (!imageBytes) continue;

            const buffer = Buffer.from(imageBytes, "base64");
            const blob = new Blob([buffer], { type: "image/png" });
            const storageId = await ctx.storage.store(blob);
            await ctx.runMutation(internal.generations.addImage, {
              generationId,
              storageId,
            });
          }
        }
      } else {
        const geminiModel = GEMINI_MODELS[actualModel] || modelName;

        let fullPrompt = finalPrompt;
        if (args.aspectRatio !== "auto") {
          fullPrompt += ` Output the image in ${args.aspectRatio} aspect ratio.`;
        }

        for (let i = 0; i < args.numberOfImages; i++) {
          const thinkingBudget = args.thinkingLevel === "high" ? 8192
            : args.thinkingLevel === "low" ? 2048
            : undefined;

          const result = await generateWithGemini(
            ai,
            geminiModel,
            fullPrompt,
            refImages,
            thinkingBudget,
            useVertex
          );

          await ctx.runMutation(internal.generations.addTokenUsage, {
            generationId,
            promptTokens: result.promptTokens,
          });

          for (const img of result.images.slice(0, 1)) {
            const buffer = Buffer.from(img.imageBytes, "base64");
            const blob = new Blob([buffer], { type: img.mimeType });
            const storageId = await ctx.storage.store(blob);
            await ctx.runMutation(internal.generations.addImage, {
              generationId,
              storageId,
            });
          }
        }
      }
      // Check if any images were actually generated
      const finalGen = await ctx.runQuery(internal.generations.get, { generationId });
      if (!finalGen || finalGen.imageStorageIds.length === 0) {
        await ctx.runMutation(internal.generations.markFailed, {
          generationId,
          error: "No images were returned. The model may have filtered the content or failed silently. Try rephrasing your prompt.",
        });
      } else {
        await ctx.runMutation(internal.generations.markComplete, { generationId });
      }
    } catch (e: any) {
      const raw = e?.message || String(e);
      let errorMsg: string;

      if (raw.includes('"code":429') || raw.includes("RESOURCE_EXHAUSTED")) {
        const usedVertex = args.provider === "vertex" || (!args.provider && hasVertexConfig());
        const retryMatch = raw.match(/Please retry in (\d+h?\d*m)/);
        const retryInfo = retryMatch ? ` Try again in ~${retryMatch[1]}.` : "";
        errorMsg = usedVertex
          ? `Vertex AI rate limit hit — too many requests per minute.${retryInfo} Try fewer images or wait a moment.`
          : `Daily API quota exceeded (250 requests).${retryInfo || " Try again tomorrow."}`;
      } else if (raw.includes("Your request couldn't be completed")) {
        errorMsg = "The model couldn't complete this request — likely content filtering or a transient error. Try rephrasing your prompt or try again.";
      } else {
        errorMsg = raw.slice(0, 500);
      }

      await ctx.runMutation(internal.generations.markFailed, {
        generationId,
        error: errorMsg,
      });
    } finally {
      if (args.referenceImageStorageIds) {
        const keepSet = new Set((args.keepReferenceIds ?? []).map((id) => id.toString()));
        for (const sid of args.referenceImageStorageIds) {
          if (!keepSet.has(sid.toString())) {
            await ctx.storage.delete(sid);
          }
        }
      }
    }

    return generationId;
  },
});

export const getAvailableProviders = action({
  args: {},
  returns: v.object({
    gemini: v.boolean(),
    vertex: v.boolean(),
  }),
  handler: async (): Promise<{ gemini: boolean; vertex: boolean }> => ({
    gemini: hasGeminiConfig(),
    vertex: hasVertexConfig(),
  }),
});
