import { literals } from "convex-helpers/validators";
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const taskTypeDbSchema = {
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
    archivedAt: v.optional(v.number()),
  }).index("by_userId", ["userId", "archivedAt"]),
  taskTypeEnumOptions: defineTable({
    taskTypeId: v.id("taskTypes"),
    name: v.string(),
    i18nKey: v.optional(v.string()),
    orderKey: v.string(),
    archivedAt: v.optional(v.number()),
  }).index("by_taskTypeId_orderKey", ["taskTypeId", "orderKey"]),
  units: defineTable({
    name: v.string(),
    i18nKey: v.optional(v.string()),
    symbol: v.optional(v.string()),
    userId: v.string(),
    archivedAt: v.optional(v.number()),
  }).index("by_userId", ["userId", "archivedAt"]),
};
