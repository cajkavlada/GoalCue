import { defineTable } from "convex/server";
import { v } from "convex/values";

export const calendarAccess = v.union(v.literal("full"), v.literal("busy"));
export const calendarChoice = v.object({
  id: v.string(),
  title: v.string(),
  timezone: v.string(),
});
export const importedEventFields = {
  sourceEventId: v.string(),
  title: v.string(),
  startAt: v.number(),
  endAt: v.number(),
  timezone: v.string(),
  allDayStart: v.optional(v.string()),
  allDayEnd: v.optional(v.string()),
  sourceStatus: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
  location: v.optional(v.string()),
  meetingLink: v.optional(v.string()),
  recurrence: v.optional(v.array(v.string())),
  recurringEventId: v.optional(v.string()),
  originalStart: v.optional(v.string()),
  iCalUID: v.optional(v.string()),
};
export const calendarDbSchema = {
  calendarGrants: defineTable({
    userId: v.string(),
    access: calendarAccess,
    email: v.string(),
    credentials: v.optional(v.string()),
    calendars: v.array(calendarChoice),
    disconnectedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),
  calendarAuthorizations: defineTable({
    userId: v.string(),
    state: v.string(),
    access: calendarAccess,
    expiresAt: v.number(),
    consumed: v.optional(v.boolean()),
  }).index("by_state", ["state"]),
  calendarSources: defineTable({
    userId: v.string(),
    grantId: v.id("calendarGrants"),
    calendarId: v.string(),
    title: v.string(),
    timezone: v.string(),
    access: calendarAccess,
    generation: v.number(),
    refreshingUntil: v.optional(v.number()),
    lastSuccessAt: v.optional(v.number()),
    lastAttemptAt: v.optional(v.number()),
    error: v.optional(v.string()),
    disconnectedAt: v.optional(v.number()),
    scopeStart: v.optional(v.number()),
    scopeEnd: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_grant", ["grantId"]),
};
