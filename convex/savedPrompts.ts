import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("savedPrompts"),
      _creationTime: v.number(),
      text: v.string(),
      name: v.string(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db
      .query("savedPrompts")
      .withIndex("by_creation")
      .order("desc")
      .collect();
  },
});

export const save = mutation({
  args: {
    text: v.string(),
    name: v.string(),
  },
  returns: v.id("savedPrompts"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("savedPrompts", {
      text: args.text,
      name: args.name,
      createdAt: Date.now(),
    });
  },
});

export const rename = mutation({
  args: {
    id: v.id("savedPrompts"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { name: args.name });
    return null;
  },
});

export const update = mutation({
  args: {
    id: v.id("savedPrompts"),
    text: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { text: args.text });
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("savedPrompts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return null;
  },
});
