import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const addName = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, { name }) => {
    console.log("This TypeScript function is running on the server.");
    await ctx.db.insert("names", { name });
  },
});

export const getNames = query({
  args: {
    count: v.number(),
  },
  handler: async (ctx, { count }) => {
    const names = await ctx.db.query("names").order("desc").take(count);
    return names.reverse();
  },
});
