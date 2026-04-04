import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("referenceImages"),
      _creationTime: v.number(),
      storageId: v.id("_storage"),
      name: v.string(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db
      .query("referenceImages")
      .withIndex("by_creation")
      .order("desc")
      .collect();
  },
});

export const getUrl = query({
  args: { storageId: v.id("_storage") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const save = mutation({
  args: {
    storageId: v.id("_storage"),
    name: v.string(),
  },
  returns: v.id("referenceImages"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("referenceImages", {
      storageId: args.storageId,
      name: args.name,
      createdAt: Date.now(),
    });
  },
});

export const rename = mutation({
  args: {
    id: v.id("referenceImages"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { name: args.name });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("referenceImages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ref = await ctx.db.get(args.id);
    if (!ref) return null;

    await ctx.storage.delete(ref.storageId);
    await ctx.db.delete(args.id);
    return null;
  },
});
