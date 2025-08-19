import { literals } from "convex-helpers/validators";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    userId: v.string(),
  }).index("by_user", ["userId"]),
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    i18nKey: v.optional(v.string()),
    userId: v.string(),
    taskTypeId: v.id("taskTypes"),
    priorityClassId: v.id("priorityClasses"),
    repetitionId: v.optional(v.id("repetitions")),
    priorityIndex: v.string(),
    dueAt: v.optional(v.string()),
    archived: v.boolean(),
    initialValue: v.union(v.boolean(), v.number()),
    currentValue: v.union(v.boolean(), v.number()),
    completedValue: v.union(v.boolean(), v.number()),
    completed: v.boolean(),
  })
    .index("by_userId", ["userId"])
    .index("by_user_priority", ["userId", "priorityClassId", "priorityIndex"]),
  taskTypes: defineTable({
    name: v.string(),
    i18nKey: v.optional(v.string()),
    unitId: v.id("units"),
    initialValue: v.optional(v.union(v.boolean(), v.number())),
    completedValue: v.optional(v.union(v.boolean(), v.number())),
    userId: v.string(),
  }).index("by_userId", ["userId"]),
  units: defineTable({
    name: v.string(),
    i18nKey: v.optional(v.string()),
    symbol: v.optional(v.string()),
    valueType: literals("number", "boolean"),
    userId: v.optional(v.string()),
  }),
  taskActions: defineTable({
    taskId: v.id("tasks"),
    value: v.union(v.boolean(), v.number()),
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
    order: v.string(),
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
