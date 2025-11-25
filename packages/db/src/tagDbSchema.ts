import { literals } from "convex-helpers/validators";
import { defineTable } from "convex/server";
import { v } from "convex/values";

import { TAG_COLORS, tagKinds } from "./constants/tag";

export const tagDbSchema = {
  tags: defineTable({
    name: v.string(),
    i18nKey: v.optional(v.string()),
    color: v.optional(
      v.union(...TAG_COLORS.map((color) => v.literal(color.value)))
    ),
    userId: v.string(),
    kind: v.optional(literals(...tagKinds)),
    archivedAt: v.optional(v.number()),
  }).index("by_userId_name", ["userId", "archivedAt", "name"]),
  tagTasks: defineTable({
    taskId: v.id("tasks"),
    tagId: v.id("tags"),
  })
    .index("by_taskId", ["taskId"])
    .index("by_tagId", ["tagId"]),
  tagEvents: defineTable({
    eventId: v.id("events"),
    tagId: v.id("tags"),
  })
    .index("by_eventId", ["eventId"])
    .index("by_tagId", ["tagId"]),
  tagTaskTypes: defineTable({
    taskTypeId: v.id("taskTypes"),
    tagId: v.id("tags"),
  })
    .index("by_taskTypeId", ["taskTypeId"])
    .index("by_tagId", ["tagId"]),
};
