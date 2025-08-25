import { literals } from "convex-helpers/validators";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const dbSchema = defineSchema({
  users: defineTable({
    userId: v.string(),
  }).index("by_user", ["userId"]),
  test: defineTable({
    name: v.string(),
  }),
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    i18nKey: v.optional(v.string()),
    userId: v.string(),
    taskTypeId: v.id("taskTypes"),
    priorityClassId: v.id("priorityClasses"),
    priorityIndex: v.string(),
    repetitionId: v.optional(v.id("repetitions")),
    dueAt: v.optional(v.string()),
    archived: v.boolean(),
    valueKind: literals("boolean", "number", "enum"),
    completed: v.boolean(),
    initialNumValue: v.optional(v.number()),
    currentNumValue: v.optional(v.number()),
    completedNumValue: v.optional(v.number()),
    currentEnumOptionId: v.optional(v.id("taskTypeEnumOptions")),
    valueUpdatedAt: v.optional(v.number()),
  })
    .index("by_user_status_priority", [
      "userId",
      "completed",
      "priorityClassId",
      "priorityIndex",
    ])
    .index("by_user_status_valueUpdatedAt_priority", [
      "userId",
      "completed",
      "valueUpdatedAt",
      "priorityClassId",
      "priorityIndex",
    ]),

  taskTypes: defineTable({
    name: v.string(),
    i18nKey: v.optional(v.string()),
    unitId: v.optional(v.id("units")),
    valueKind: literals("boolean", "number", "enum"),
    initialNumValue: v.optional(v.number()),
    completedNumValue: v.optional(v.number()),
    initialEnumOptionId: v.optional(v.id("taskTypeEnumOptions")),
    completedEnumOptionId: v.optional(v.id("taskTypeEnumOptions")),
    userId: v.string(),
  }).index("by_userId", ["userId"]),
  taskTypeEnumOptions: defineTable({
    taskTypeId: v.id("taskTypes"),
    name: v.string(),
    i18nKey: v.optional(v.string()),
    orderKey: v.string(),
  }).index("by_taskTypeId_orderKey", ["taskTypeId", "orderKey"]),
  units: defineTable({
    name: v.string(),
    i18nKey: v.optional(v.string()),
    symbol: v.optional(v.string()),
    userId: v.optional(v.string()),
  }),
  taskActions: defineTable({
    taskId: v.id("tasks"),
    boolValue: v.optional(v.boolean()),
    numValue: v.optional(v.number()),
    enumOptionId: v.optional(v.id("taskTypeEnumOptions")),
    note: v.optional(v.string()),
  }).index("by_taskId", ["taskId"]),
  repetitions: defineTable({
    taskId: v.id("tasks"),
    repetitionType: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("yearly")
    ),
    repetitionInterval: v.number(),
    startDate: v.string(),
    endDate: v.optional(v.string()),
  }),
  priorityClasses: defineTable({
    userId: v.string(),
    name: v.string(),
    i18nKey: v.optional(v.string()),
    color: v.optional(v.string()),
    orderKey: v.string(),
  }).index("by_userId", ["userId"]),
  events: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    i18nKey: v.optional(v.string()),
    userId: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    priorityClassId: v.id("priorityClasses"),
    priorityScore: v.number(),
  }),
});
