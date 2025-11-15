import { defineTable } from "convex/server";
import { v } from "convex/values";

export const eventsDbSchema = {
  events: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    i18nKey: v.optional(v.string()),
    userId: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    priorityClassId: v.id("priorityClasses"),
    priorityScore: v.number(),
    archivedAt: v.optional(v.number()),
  }),
};
