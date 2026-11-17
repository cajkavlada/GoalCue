import { ConvexError, v } from "convex/values";

import { fixedEventFields, planningFields } from "@gc/db";
import {
  dayBounds,
  localDateTime,
  locationConflicts,
  overlaps,
  placementConflicts,
  projectAllDayEvent,
  shiftDate,
  validatePlanning,
  validateTravel,
} from "@gc/validators";

import { taskQueries } from "./dbQueries";
import { authedMutation, authedQuery } from "./utils/authedFunctions";
import { autoPlan } from "./utils/autoPlan";
import { planningTool } from "./utils/planningTool";
import { resolveOccurrence } from "./utils/recurrence";

export const scheduleTaskTool = planningTool({
  args: { taskId: v.id("tasks"), date: v.string(), timezone: v.string() },
  rateLimit: { name: "scheduleTask" },
  handler: async (ctx, { taskId, date, timezone }) => {
    const requested = await taskQueries({ ctx }).getById({ taskId });
    if (
      requested.archivedAt !== undefined ||
      requested.completedAt !== undefined
    )
      throw new ConvexError({ message: "Choose an active Task" });
    const task = await resolveOccurrence(
      ctx,
      requested,
      dayBounds(date, timezone).startAt
    );
    if (
      task.archivedAt !== undefined ||
      task.completedAt !== undefined ||
      task.expiredAt !== undefined ||
      task.effortMinutes === undefined
    )
      throw new ConvexError({
        message: "Choose an active Task with an Effort estimate",
      });
    try {
      dayBounds(date, timezone);
    } catch {
      throw new ConvexError({
        message: "Enter a valid planning date and timezone",
      });
    }
    await ctx.db.patch(task._id, { automaticSchedulingPaused: false });
    await autoPlan(ctx, { date, timezone });
  },
});

export const getDayPlan = authedQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("dayPlans")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .first(),
});

export const listWork = authedQuery({
  args: {},
  handler: async (ctx) =>
    (
      await ctx.db
        .query("tasks")
        .withIndex("by_user_priority", (q) => q.eq("userId", ctx.userId))
        .collect()
    )
      .filter(
        (task) =>
          task.archivedAt === undefined &&
          task.completedAt === undefined &&
          task.expiredAt === undefined &&
          !task.recurrence
      )
      .map((task) => ({
        _id: task._id,
        title: task.title,
        dueAt: task.dueAt,
        finishKind: task.finishKind,
        effortMinutes: task.effortMinutes,
        projectId: task.projectId,
        milestoneId: task.milestoneId,
      })),
});

export const planDayTool = planningTool({
  args: {
    date: v.string(),
    timezone: v.string(),
    replanAll: v.optional(v.boolean()),
  },
  rateLimit: { name: "planDay" },
  handler: async (ctx, selection) => {
    try {
      dayBounds(selection.date, selection.timezone);
    } catch {
      throw new ConvexError({
        message: "Enter a valid planning date and timezone",
      });
    }
    await autoPlan(ctx, selection);
  },
});

export const undoPlan = authedMutation({
  args: {},
  rateLimit: { name: "undoPlan" },
  handler: async (ctx) => {
    const state = await ctx.db
      .query("dayPlans")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .first();
    if (!state || (!state.changes.length && !state.recoveryUndo?.length))
      return;
    const settings = await ctx.db
      .query("planningSettings")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .first();
    const events = (
      await ctx.db
        .query("fixedEvents")
        .withIndex("by_user_start", (q) => q.eq("userId", ctx.userId))
        .collect()
    ).filter((e) => e.deletedAt === undefined);
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user_start", (q) => q.eq("userId", ctx.userId))
      .collect();
    const now = Date.now();
    for (const undo of state.recoveryUndo ?? []) {
      const request = await ctx.db.get(undo.requestId);
      if (!request || request.revision !== undo.revision)
        throw new ConvexError({
          message: "Recovery has changed; adjust it individually",
        });
      for (const id of undo.sessionIds) {
        const session = sessions.find((s) => s._id === id);
        if (
          !session ||
          session.startAt <= now ||
          session.pinned ||
          session.manualOverride ||
          session.checkIn ||
          session.unscheduledAt !== undefined
        )
          throw new ConvexError({
            message: "Recovery has changed or started; adjust it individually",
          });
      }
    }
    for (const change of state.changes) {
      const session = sessions.find((s) => s._id === change.sessionId);
      const task = await ctx.db.get(change.taskId);
      if (
        !session ||
        session.userId !== ctx.userId ||
        session.revision !== change.revision ||
        session.pinned ||
        (session.unscheduledAt === undefined && session.startAt <= now) ||
        !task ||
        task.userId !== ctx.userId ||
        task.completedAt !== undefined ||
        task.archivedAt !== undefined
      )
        throw new ConvexError({
          message:
            "The plan has changed or work has started; adjust these Sessions individually",
        });
      if (
        change.before &&
        (change.before.startAt <= now ||
          placementConflicts(change.before, settings, events).length ||
          locationConflicts(change.before, task, events).length ||
          (task.dueAt !== undefined &&
            task.finishKind !== "preferred" &&
            change.before.endAt > task.dueAt) ||
          sessions.some(
            (other) =>
              other.unscheduledAt === undefined &&
              !state.changes.some((c) => c.sessionId === other._id) &&
              overlaps(other, change.before!)
          ))
      )
        throw new ConvexError({
          message:
            "The previous placement is no longer possible; resolve its boundary conflict first",
        });
    }
    for (const undo of state.recoveryUndo ?? []) {
      await ctx.db.patch(undo.requestId, {
        revision: undo.revision + 1,
        allocations: undo.allocations,
        ...(undo.created ? { undoneAt: now } : { dismissedAt: now }),
      });
      for (const id of undo.sessionIds)
        await ctx.db.patch(id, { unscheduledAt: now });
    }
    for (const change of state.changes) {
      await ctx.db.patch(change.sessionId, {
        ...change.before,
        unscheduledAt: change.before ? undefined : now,
        manualOverride: true,
        automaticReason: undefined,
        revision: change.revision + 1,
      });
      if (!change.before)
        await ctx.db.patch(change.taskId, { automaticSchedulingPaused: true });
    }
    await ctx.db.patch(state._id, {
      changes: [],
      shortfalls: [],
      conflicts: [],
      recoveryUndo: [],
    });
    await autoPlan(ctx);
  },
});

export const listRecovery = authedQuery({
  args: {},
  handler: async (ctx) =>
    (
      await ctx.db
        .query("recoveryRequests")
        .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
        .collect()
    ).filter((r) => r.undoneAt === undefined),
});

export const updateRecovery = authedMutation({
  args: {
    requestId: v.id("recoveryRequests"),
    action: v.union(v.literal("dismiss"), v.literal("extend")),
  },
  rateLimit: { name: "updateRecovery" },
  handler: async (ctx, { requestId, action }) => {
    const request = await ctx.db.get(requestId);
    if (
      !request ||
      request.userId !== ctx.userId ||
      request.undoneAt !== undefined
    )
      throw new ConvexError({ message: "Recovery request not found" });
    const settings = await ctx.db
      .query("planningSettings")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .first();
    const today = localDateTime(Date.now(), settings?.timezone ?? "UTC").slice(
      0,
      10
    );
    await ctx.db.patch(
      requestId,
      action === "dismiss"
        ? { dismissedAt: Date.now(), revision: (request.revision ?? 0) + 1 }
        : {
            revision: (request.revision ?? 0) + 1,
            dismissedAt: undefined,
            expiresOn: shiftDate(
              request.expiresOn > today ? request.expiresOn : today,
              settings?.recoveryWindowDays ?? 7
            ),
          }
    );
    if (action === "dismiss") {
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_user_start", (q) => q.eq("userId", ctx.userId))
        .collect();
      for (const session of sessions.filter(
        (s) =>
          s.recoveryRequestId === requestId &&
          s.startAt > Date.now() &&
          !s.pinned &&
          !s.checkIn
      ))
        await ctx.db.patch(session._id, { unscheduledAt: Date.now() });
    }
    await autoPlan(ctx);
  },
});

export const getSettings = authedQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("planningSettings")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .first(),
});

export const saveSettingsTool = planningTool({
  args: planningFields,
  rateLimit: { name: "savePlanningSettings" },
  handler: async (ctx, settings) => {
    try {
      validatePlanning(settings);
    } catch (error) {
      throw new ConvexError({
        message:
          error instanceof Error ? error.message : "Invalid Availability",
      });
    }
    const existing = await ctx.db
      .query("planningSettings")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, settings);
      await autoPlan(ctx);
      return existing._id;
    }
    const id = await ctx.db.insert("planningSettings", {
      ...settings,
      userId: ctx.userId,
    });
    await autoPlan(ctx);
    return id;
  },
});

export const listEvents = authedQuery({
  args: { timezone: v.optional(v.string()) },
  handler: async (ctx, { timezone }) =>
    (
      await ctx.db
        .query("fixedEvents")
        .withIndex("by_user_start", (q) => q.eq("userId", ctx.userId))
        .collect()
    )
      .filter((event) => event.deletedAt === undefined)
      .map((event) => projectAllDayEvent(event, timezone ?? event.timezone)),
});

export const setEventAttention = authedMutation({
  args: { eventId: v.id("fixedEvents"), attention: fixedEventFields.attention },
  rateLimit: { name: "setEventAttention" },
  handler: async (ctx, { eventId, attention }) => {
    const event = await ctx.db.get(eventId);
    if (!event || event.userId !== ctx.userId || event.deletedAt !== undefined)
      throw new ConvexError({ message: "Event not found" });
    await ctx.db.patch(eventId, { attention, attentionUncertain: false });
    await autoPlan(ctx);
  },
});

export const saveEventTool = planningTool({
  args: { eventId: v.optional(v.id("fixedEvents")), ...fixedEventFields },
  rateLimit: { name: "saveEvent" },
  handler: async (ctx, { eventId, ...event }) => {
    try {
      validateTravel(event);
    } catch (error) {
      throw new ConvexError({
        message: error instanceof Error ? error.message : "Invalid travel",
      });
    }
    if (
      !event.title.trim() ||
      !Number.isFinite(event.startAt) ||
      !Number.isFinite(event.endAt) ||
      event.endAt <= event.startAt ||
      Math.abs(event.startAt) > 8640000000000000 ||
      Math.abs(event.endAt) > 8640000000000000
    )
      throw new ConvexError({
        message: "Enter an Event title and an end after its start",
      });
    try {
      new Intl.DateTimeFormat("en", { timeZone: event.timezone });
    } catch {
      throw new ConvexError({ message: "Enter a valid IANA timezone" });
    }
    const values = {
      ...event,
      title: event.title.trim(),
    };
    if (eventId) {
      const existing = await ctx.db.get(eventId);
      if (
        !existing ||
        existing.userId !== ctx.userId ||
        existing.deletedAt !== undefined
      )
        throw new ConvexError({ message: "Event not found" });
      if (existing.sourceId) {
        if (
          event.title !== existing.title ||
          event.startAt !== existing.startAt ||
          event.endAt !== existing.endAt ||
          event.timezone !== existing.timezone
        )
          throw new ConvexError({
            message: "Imported Event details are read-only",
          });
        await ctx.db.patch(eventId, {
          attention: event.attention,
          attentionUncertain: false,
        });
        await autoPlan(ctx);
        return eventId;
      }
      await ctx.db.patch(eventId, {
        ...values,
        ...(existing.workSourceId &&
        event.startAt === existing.startAt &&
        event.endAt === existing.endAt
          ? {}
          : { allDayStart: undefined, allDayEnd: undefined }),
      });
      await autoPlan(ctx);
      return eventId;
    }
    const id = await ctx.db.insert("fixedEvents", {
      ...values,
      userId: ctx.userId,
    });
    await autoPlan(ctx);
    return id;
  },
});

export const deleteEventTool = planningTool({
  args: { eventId: v.id("fixedEvents") },
  rateLimit: { name: "deleteEvent" },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
    if (!event || event.userId !== ctx.userId)
      throw new ConvexError({ message: "Event not found" });
    if (event.sourceId)
      throw new ConvexError({
        message: "Disconnect the calendar Source to remove imported Events",
      });
    await ctx.db.patch(eventId, {
      deletedAt: Date.now(),
      ...(event.workSourceId ? { locallyDeleted: true } : {}),
    });
    await autoPlan(ctx);
  },
});

export const saveSettings = authedMutation(saveSettingsTool);
export const saveEvent = authedMutation(saveEventTool);
export const deleteEvent = authedMutation(deleteEventTool);
export const scheduleTask = authedMutation(scheduleTaskTool);
export const planDay = authedMutation(planDayTool);
