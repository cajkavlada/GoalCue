import { literals } from "convex-helpers/validators";
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const recurrenceRule = v.object({
  kind: literals("calendar", "frequency", "volume", "completion"),
  unit: literals("day", "week", "month", "year"),
  interval: v.number(),
  startDate: v.string(),
  time: v.string(),
  timezone: v.string(),
  weekStartsOn: v.number(),
  count: v.number(),
  volume: v.number(),
  carryForward: v.boolean(),
  endDate: v.optional(v.string()),
  endAfter: v.optional(v.number()),
});

const sessionFields = {
  userId: v.string(),
  taskId: v.id("tasks"),
  startAt: v.number(),
  endAt: v.number(),
  unscheduledAt: v.optional(v.number()),
  pinned: v.optional(v.boolean()),
  manualOverride: v.optional(v.boolean()),
  revision: v.optional(v.number()),
  automaticReason: v.optional(v.string()),
  askAfter: v.optional(v.number()),
  checkInRequestedAt: v.optional(v.number()),
  checkInUpdatedAt: v.optional(v.number()),
  planningEffortMinutes: v.optional(v.number()),
  checkIn: v.optional(
    v.object({
      outcome: literals("finished", "progress", "missed"),
      reportedAt: v.number(),
      measure: v.optional(literals("done", "time", "percentage", "quantity")),
      value: v.optional(v.number()),
      contribution: v.number(),
      timeMinutes: v.number(),
      remainingMinutes: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      previousCompletedAt: v.optional(v.number()),
    })
  ),
};

const progressSnapshot = {
  currentNumValue: v.optional(v.number()),
  completedAt: v.optional(v.number()),
};

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
    recurrence: v.optional(recurrenceRule),
    recurrenceRevision: v.optional(v.number()),
    recurrenceFromAt: v.optional(v.number()),
    seriesId: v.optional(v.id("tasks")),
    occurrenceKey: v.optional(v.string()),
    occurrenceStartAt: v.optional(v.number()),
    occurrenceTimezone: v.optional(v.string()),
    occurrenceEndAt: v.optional(v.number()),
    occurrenceCarryForward: v.optional(v.boolean()),
    occurrenceException: v.optional(v.boolean()),
    occurrencePreviousId: v.optional(v.id("tasks")),
    occurrencePreviousCompletedAt: v.optional(v.number()),
    expiredAt: v.optional(v.number()),
    effortMinutes: v.optional(v.number()),
    minSessionMinutes: v.optional(v.number()),
    maxSessionMinutes: v.optional(v.number()),
    automaticSchedulingPaused: v.optional(v.boolean()),
    priority: v.optional(literals("low", "normal", "high", "critical")),
    finishKind: v.optional(literals("firm", "preferred")),
    progressMeasure: v.optional(
      literals("done", "time", "percentage", "quantity")
    ),
    progressUnit: v.optional(v.string()),
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
    .index("by_user_priority", ["userId", "priorityClassId", "priorityIndex"])
    .index("by_series", ["seriesId"])
    .index("by_user_catalog", [
      "userId",
      "seriesId",
      "archivedAt",
      "completedAt",
      "priorityClassId",
      "priorityIndex",
    ])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["userId", "archivedAt", "completedAt", "seriesId"],
    }),
  sessions: defineTable(sessionFields)
    .index("by_user_start", ["userId", "startAt"])
    .index("by_task", ["taskId"]),
  checkInBatches: defineTable({
    userId: v.string(),
    outcome: literals("finished", "missed", "later"),
    undoneAt: v.optional(v.number()),
    tasks: v.array(
      v.object({
        taskId: v.id("tasks"),
        before: v.object(progressSnapshot),
        after: v.object(progressSnapshot),
      })
    ),
    sessions: v.array(
      v.object({
        sessionId: v.id("sessions"),
        before: v.optional(v.object(sessionFields)),
        after: v.object(sessionFields),
      })
    ),
  }).index("by_user", ["userId"]),
  taskActions: defineTable({
    taskId: v.id("tasks"),
    boolValue: v.optional(v.boolean()),
    numValue: v.optional(v.number()),
    enumOptionId: v.optional(v.id("taskTypeEnumOptions")),
    note: v.optional(v.string()),
  }).index("by_taskId", ["taskId"]),
};
