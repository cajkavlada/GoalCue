import { defineTable } from "convex/server";
import { v } from "convex/values";

import { importedEventFields } from "./calendarDbSchema";

export const timeWindow = v.object({ start: v.number(), end: v.number() });
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
  title: v.string(),
  startAt: v.number(),
  endAt: v.number(),
  timezone: v.string(),
  attention: v.union(v.literal("focused"), v.literal("background")),
};
export const planningDbSchema = {
  projects: defineTable({
    userId: v.string(),
    title: v.string(),
    weeklyMinutes: v.number(),
    weekdays: v.array(v.number()),
  }).index("by_user", ["userId"]),
  milestones: defineTable({
    userId: v.string(),
    projectId: v.id("projects"),
    title: v.string(),
  }).index("by_user", ["userId"]),
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
    projectShortfalls: v.optional(
      v.array(
        v.object({
          projectId: v.id("projects"),
          title: v.string(),
          minutes: v.number(),
          reason: v.string(),
        })
      )
    ),
  }).index("by_user", ["userId"]),
  planningSettings: defineTable({
    userId: v.string(),
    ...planningFields,
  }).index("by_user", ["userId"]),
  fixedEvents: defineTable({
    userId: v.string(),
    ...fixedEventFields,
    sourceId: v.optional(v.id("calendarSources")),
    sourceEventId: v.optional(v.string()),
    sourceTitle: v.optional(v.string()),
    sourceAccess: v.optional(v.union(v.literal("full"), v.literal("busy"))),
    sourceStatus: importedEventFields.sourceStatus,
    sourceUrl: importedEventFields.sourceUrl,
    location: importedEventFields.location,
    meetingLink: importedEventFields.meetingLink,
    recurrence: importedEventFields.recurrence,
    recurringEventId: importedEventFields.recurringEventId,
    originalStart: importedEventFields.originalStart,
    iCalUID: importedEventFields.iCalUID,
    allDayStart: importedEventFields.allDayStart,
    allDayEnd: importedEventFields.allDayEnd,
    attentionUncertain: v.optional(v.boolean()),
    compatibleActivities: v.optional(v.array(v.string())),
    deletedAt: v.optional(v.number()),
  })
    .index("by_user_start", ["userId", "startAt"])
    .index("by_source", ["sourceId", "sourceEventId"]),
};
