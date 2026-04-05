import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  referenceImages: defineTable({
    storageId: v.id("_storage"),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_creation", ["createdAt"]),

  savedPrompts: defineTable({
    text: v.string(),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_creation", ["createdAt"]),

  generations: defineTable({
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
    promptTokens: v.optional(v.number()),
    cachedTokens: v.optional(v.number()),
    status: v.optional(v.union(v.literal("generating"), v.literal("complete"), v.literal("failed"))),
    error: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_creation", ["createdAt"]),
});
