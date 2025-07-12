import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  names: defineTable({
    name: v.string(),
  }),
});
