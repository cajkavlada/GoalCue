import { defineTable } from "convex/server";
import { v } from "convex/values";

import { importedEventFields } from "./calendarDbSchema";

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
  recoveryWindowDays: v.optional(v.number()),
  dailyRecoveryMinutes: v.optional(v.number()),
  reservePreferredMinutes: v.optional(v.number()),
  reserveMinimumMinutes: v.optional(v.number()),
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
  workCalendarSources: defineTable({
    userId: v.string(),
    name: v.string(),
    aiEnabled: v.boolean(),
    lastSuccessAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),
  recoveryRequests: defineTable({
    userId: v.string(),
    revision: v.optional(v.number()),
    taskId: v.optional(v.id("tasks")),
    kind: v.union(v.literal("leisure"), v.literal("reserve")),
    title: v.string(),
    date: v.string(),
    expiresOn: v.string(),
    minutes: v.number(),
    dismissedAt: v.optional(v.number()),
    undoneAt: v.optional(v.number()),
    allocations: v.array(v.object({ startAt: v.number(), endAt: v.number() })),
  }).index("by_user", ["userId"]),
  projects: defineTable({
    userId: v.string(),
    importance: v.optional(
      v.union(
        v.literal("low"),
        v.literal("normal"),
        v.literal("high"),
        v.literal("critical")
      )
    ),
    title: v.string(),
    weeklyMinutes: v.number(),
    weekdays: v.array(v.number()),
  }).index("by_user", ["userId"]),
  milestones: defineTable({
    userId: v.string(),
    importance: v.optional(
      v.union(
        v.literal("low"),
        v.literal("normal"),
        v.literal("high"),
        v.literal("critical")
      )
    ),
    projectId: v.id("projects"),
    title: v.string(),
  }).index("by_user", ["userId"]),
  dayPlans: defineTable({
    recoveryUndo: v.optional(
      v.array(
        v.object({
          requestId: v.id("recoveryRequests"),
          created: v.boolean(),
          revision: v.number(),
          allocations: v.array(
            v.object({ startAt: v.number(), endAt: v.number() })
          ),
          sessionIds: v.array(v.id("sessions")),
        })
      )
    ),
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
    workSourceId: v.optional(v.id("workCalendarSources")),
    importScope: v.optional(v.string()),
    sourceKey: v.optional(v.string()),
    sourceSnapshot: v.optional(v.string()),
    sourceOverrides: v.optional(v.array(v.string())),
    sourceRemoved: v.optional(v.boolean()),
    locallyDeleted: v.optional(v.boolean()),
    sourceLink: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_user_start", ["userId", "startAt"])
    .index("by_source", ["sourceId", "sourceEventId"]),
};
