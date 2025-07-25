import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    userId: v.string(),
    taskTypeId: v.optional(v.id("taskType")), //TODO: remove optional
    repetitionId: v.optional(v.id("repetition")), //TODO: remove optional
    priorityClassId: v.optional(v.id("priorityClasses")), //TODO: remove optional
    priorityScore: v.number(),
    dueAt: v.optional(v.string()),
    archived: v.boolean(),
  }).index("by_user", ["userId"]),
  taskTypes: defineTable({
    name: v.string(),
    unitId: v.id("units"),
    completedWhen: v.optional(v.union(v.boolean(), v.number())),
    userId: v.string(),
  }),
  units: defineTable({
    name: v.string(),
    symbol: v.optional(v.string()),
    valueType: v.union(
      v.literal("number"),
      v.literal("boolean")
    ),
    userId: v.optional(v.string()),
  }),
  taskActions: defineTable({
    taskId: v.id("tasks"),
    value: v.union(
      v.literal("number"),
      v.literal("boolean")
    ),
    date: v.string(),
    note: v.optional(v.string()),
  }),
  repetitions: defineTable({
    taskId: v.id("tasks"),
    repetitionType: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("yearly"),
    ),
    repetitionInterval: v.number(),
    startDate: v.string(),
    endDate: v.optional(v.string()),
  }),
  priorityClasses: defineTable({
    userId: v.string(),
    name: v.string(),
    color: v.optional(v.string()),
    order: v.number(),
  }),
  events: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    userId: v.string(), 
    startTime: v.string(),
    endTime: v.string(),
    priorityClassId: v.id("priorityClasses"),
    priorityScore: v.number(),
  }),
});
