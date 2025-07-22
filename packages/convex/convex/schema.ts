import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  names: defineTable({
    name: v.string(),
  }),
  userNotes: defineTable({
    userId: v.string(),
    note: v.string(),
  }),
});
