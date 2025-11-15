import { defineTable } from "convex/server";
import { v } from "convex/values";

export const priorityClassDbSchema = {
  priorityClasses: defineTable({
    userId: v.string(),
    name: v.string(),
    i18nKey: v.optional(v.string()),
    color: v.optional(v.string()),
    orderKey: v.string(),
    archivedAt: v.optional(v.number()),
  }).index("by_userId_orderKey", ["userId", "orderKey"]),
};
