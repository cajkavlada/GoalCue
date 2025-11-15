import { literals } from "convex-helpers/validators";
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const taskDbSchema = {
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    i18nKey: v.optional(v.string()),
    userId: v.string(),
    taskTypeId: v.id("taskTypes"),
    priorityClassId: v.id("priorityClasses"),
    priorityIndex: v.string(),
    repetitionId: v.optional(v.id("repetitions")),
    dueAt: v.optional(v.number()),
    archivedAt: v.optional(v.number()),
    valueKind: literals("boolean", "number", "enum"),
    completedAt: v.optional(v.number()),
    initialNumValue: v.optional(v.number()),
    currentNumValue: v.optional(v.number()),
    completedNumValue: v.optional(v.number()),
    currentEnumOptionId: v.optional(v.id("taskTypeEnumOptions")),
  })
    .index("by_user_status_priority", [
      "userId",
      "archivedAt",
      "completedAt",
      "priorityClassId",
      "priorityIndex",
    ])
    .index("by_user_priority", ["userId", "priorityClassId", "priorityIndex"]),
  taskActions: defineTable({
    taskId: v.id("tasks"),
    boolValue: v.optional(v.boolean()),
    numValue: v.optional(v.number()),
    enumOptionId: v.optional(v.id("taskTypeEnumOptions")),
    note: v.optional(v.string()),
  }).index("by_taskId", ["taskId"]),
};
