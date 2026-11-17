import { defineTable } from "convex/server";
import { v } from "convex/values";

export const timeWindow = v.object({ start: v.number(), end: v.number() });
export const attendanceFields = {
  attendance: v.optional(
    v.union(
      v.literal("unknown"),
      v.literal("online"),
      v.literal("physical"),
      v.literal("hybrid")
    )
  ),
  hybridAttendance: v.optional(
    v.union(v.literal("online"), v.literal("physical"))
  ),
  locationRequirement: v.optional(v.string()),
};
export const journey = v.object({
  origin: v.string(),
  mode: v.union(
    v.literal("walk"),
    v.literal("cycle"),
    v.literal("drive"),
    v.literal("transit")
  ),
  routeMinutes: v.optional(v.number()),
  marginPercent: v.number(),
  arrivalMinutes: v.number(),
  wrapUpMinutes: v.number(),
});
export const weeklyWindow = v.object({
  weekday: v.number(),
  start: v.number(),
  end: v.number(),
});
export const dateOverride = v.object({
  date: v.string(),
  mode: v.union(
    v.literal("add"),
    v.literal("remove"),
    v.literal("replace"),
    v.literal("close")
  ),
  windows: v.array(timeWindow),
});
export const planningFields = {
  timezone: v.string(),
  weekStartsOn: v.optional(v.number()),
  restrictAvailability: v.optional(v.boolean()),
  weekly: v.array(weeklyWindow),
  overrides: v.array(dateOverride),
  protectedWeekly: v.array(weeklyWindow),
  protectedDates: v.array(
    v.object({ date: v.string(), start: v.number(), end: v.number() })
  ),
};
export const fixedEventFields = {
  ...attendanceFields,
  journey: v.optional(journey),
  title: v.string(),
  startAt: v.number(),
  endAt: v.number(),
  timezone: v.string(),
  attention: v.union(v.literal("focused"), v.literal("background")),
};
export const planningDbSchema = {
  dayPlans: defineTable({
    userId: v.string(),
    date: v.string(),
    timezone: v.string(),
    changes: v.array(
      v.object({
        sessionId: v.id("sessions"),
        taskId: v.id("tasks"),
        title: v.string(),
        reason: v.string(),
        revision: v.number(),
        before: v.optional(
          v.object({ startAt: v.number(), endAt: v.number() })
        ),
        after: v.optional(v.object({ startAt: v.number(), endAt: v.number() })),
      })
    ),
    shortfalls: v.array(
      v.object({
        taskId: v.id("tasks"),
        title: v.string(),
        minutes: v.number(),
        reason: v.string(),
      })
    ),
    conflicts: v.array(v.string()),
  }).index("by_user", ["userId"]),
  planningSettings: defineTable({
    userId: v.string(),
    ...planningFields,
  }).index("by_user", ["userId"]),
  fixedEvents: defineTable({
    userId: v.string(),
    ...fixedEventFields,
    compatibleActivities: v.optional(v.array(v.string())),
    deletedAt: v.optional(v.number()),
  }).index("by_user_start", ["userId", "startAt"]),
};
