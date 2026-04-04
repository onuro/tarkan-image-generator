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
};

async function enhancePrompt(
  ai: GoogleGenAI,
  prompt: string
): Promise<string> {
  // Skip if prompt is already detailed enough
  const wordCount = prompt.trim().split(/\s+/).length;
  if (wordCount >= 40) {
    return prompt;
  }

  const systemPrompt = `Append exactly 5-10 words to the end of this image generation prompt. Your addition MUST be directly relevant to the specific subject, materials, and scene described in the prompt. If the prompt mentions asphalt, add something about asphalt (like wet surface reflections). If it mentions a forest, add something about the forest. NEVER add elements that aren't already implied by the scene (no sky if the scene is a close-up, no ocean if the scene is indoors). Do NOT change any of the original words. Output the full prompt with your addition at the end. No quotes or explanation.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\nUser prompt: ${prompt}` }],
      },
    ],
    config: {
      maxOutputTokens: 1000,
    },
  });

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
  referenceBase64: string | null,
  refMimeType: string
): Promise<{ imageBytes: string; mimeType: string }[]> {
  const parts: any[] = [{ text: prompt }];

  if (referenceBase64) {
    parts.push({
      inlineData: {
        mimeType: refMimeType,
        data: referenceBase64,
      },
    });
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [{ role: "user", parts }],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

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
  return images;
}

export const generate = action({
  args: {
    prompt: v.string(),
    originalPrompt: v.optional(v.string()),
    stylePreset: v.optional(v.string()),
    styleSuffix: v.optional(v.string()),
    aspectRatio: v.string(),
    numberOfImages: v.number(),
    referenceImageStorageId: v.optional(v.id("_storage")),
    keepReference: v.optional(v.boolean()),
    enhancePrompt: v.optional(v.boolean()),
    model: v.optional(v.string()),
  },
  returns: v.id("generations"),
  handler: async (ctx, args): Promise<Id<"generations">> => {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GOOGLE_AI_API_KEY is not set. Add it in the Convex dashboard under Settings > Environment Variables."
      );
    }

    const ai = new GoogleGenAI({ apiKey });
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
    let refBase64: string | null = null;
    let refMimeType = "image/png";
    if (args.referenceImageStorageId) {
      const refBlob = await ctx.storage.get(args.referenceImageStorageId);
      if (!refBlob) throw new Error("Reference image not found in storage.");
      const refBuffer = Buffer.from(await refBlob.arrayBuffer());
      refBase64 = refBuffer.toString("base64");
      refMimeType = refBlob.type || "image/png";
    }

    // Determine the actual model that will be used
    const actualModel =
      isImagen && !refBase64
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
    });

    try {
      if (isImagen && !refBase64) {
        const aspectRatio = args.aspectRatio === "auto" ? "1:1" : args.aspectRatio;

        const response = await ai.models.generateImages({
          model: modelName,
          prompt: finalPrompt,
          config: {
            numberOfImages: args.numberOfImages,
            aspectRatio,
          },
        });

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
        const geminiModel = isImagen
          ? GEMINI_MODELS["nano-banana-pro"]
          : modelName;

        let fullPrompt = finalPrompt;
        if (args.aspectRatio !== "auto") {
          fullPrompt += ` Output the image in ${args.aspectRatio} aspect ratio.`;
        }

        for (let i = 0; i < args.numberOfImages; i++) {
          const images = await generateWithGemini(
            ai,
            geminiModel,
            fullPrompt,
            refBase64,
            refMimeType
          );

          for (const img of images) {
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
    } finally {
      if (args.referenceImageStorageId && !args.keepReference) {
        await ctx.storage.delete(args.referenceImageStorageId);
      }
    }

    return generationId;
  },
});
