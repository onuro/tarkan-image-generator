import { query, internalQuery, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const get = internalQuery({
  args: { generationId: v.id("generations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.generationId);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("generations")
      .withIndex("by_creation")
      .order("desc")
      .collect();
  },
});


export const getImageUrls = query({
  args: { storageIds: v.array(v.id("_storage")) },
  returns: v.array(v.union(v.string(), v.null())),
  handler: async (ctx, args) => {
    const urls = await Promise.all(
      args.storageIds.map((id) => ctx.storage.getUrl(id))
    );
    return urls;
  },
});

export const create = internalMutation({
  args: {
    prompt: v.string(),
    originalPrompt: v.optional(v.string()),
    stylePreset: v.optional(v.string()),
    styleSuffix: v.optional(v.string()),
    wasEnhanced: v.optional(v.boolean()),
    enhancedPrompt: v.optional(v.string()),
    aspectRatio: v.string(),
    numberOfImages: v.number(),
    imageStorageIds: v.array(v.id("_storage")),
    model: v.optional(v.string()),
    referenceImageStorageIds: v.optional(v.array(v.id("_storage"))),
    thinkingLevel: v.optional(v.string()),
  },
  returns: v.id("generations"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("generations", {
      prompt: args.prompt,
      originalPrompt: args.originalPrompt,
      stylePreset: args.stylePreset,
      styleSuffix: args.styleSuffix,
      wasEnhanced: args.wasEnhanced,
      enhancedPrompt: args.enhancedPrompt,
      aspectRatio: args.aspectRatio,
      numberOfImages: args.numberOfImages,
      imageStorageIds: args.imageStorageIds,
      model: args.model,
      referenceImageStorageIds: args.referenceImageStorageIds,
      thinkingLevel: args.thinkingLevel,
      status: "generating",
      createdAt: Date.now(),
    });
  },
});

export const markComplete = internalMutation({
  args: { generationId: v.id("generations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.generationId);
    if (!doc) return null;
    await ctx.db.patch(args.generationId, { status: "complete" });
    return null;
  },
});

export const markFailed = internalMutation({
  args: {
    generationId: v.id("generations"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.generationId);
    if (!doc) return null;
    await ctx.db.patch(args.generationId, {
      status: "failed",
      error: args.error,
    });
    return null;
  },
});

export const addImage = internalMutation({
  args: {
    generationId: v.id("generations"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const generation = await ctx.db.get(args.generationId);
    if (!generation) return null;

    await ctx.db.patch(args.generationId, {
      imageStorageIds: [...generation.imageStorageIds, args.storageId],
    });
    return null;
  },
});

export const addTokenUsage = internalMutation({
  args: {
    generationId: v.id("generations"),
    promptTokens: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const generation = await ctx.db.get(args.generationId);
    if (!generation) return null;

    await ctx.db.patch(args.generationId, {
      promptTokens: (generation.promptTokens ?? 0) + args.promptTokens,
    });
    return null;
  },
});

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const cleanupOrphanedFiles = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const generations = await ctx.db.query("generations").collect();
    const referencedIds = new Set(
      generations.flatMap((g) => [
        ...g.imageStorageIds.map((id) => id.toString()),
        ...(g.referenceImageStorageIds ?? []).map((id) => id.toString()),
      ])
    );

    const allFiles = await ctx.db.system.query("_storage").collect();
    let deleted = 0;
    for (const file of allFiles) {
      if (!referencedIds.has(file._id.toString())) {
        await ctx.storage.delete(file._id);
        deleted++;
      }
    }
    return deleted;
  },
});

export const remove = mutation({
  args: { generationId: v.id("generations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const generation = await ctx.db.get(args.generationId);
    if (!generation) return null;

    await Promise.all(
      generation.imageStorageIds.map((id) => ctx.storage.delete(id))
    );

    await ctx.db.delete(args.generationId);
    return null;
  },
});
