import { defineTable } from "convex/server";
import { v } from "convex/values";

export const repetitionDbSchema = {
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
};
