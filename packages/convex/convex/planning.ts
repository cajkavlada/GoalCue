import { ConvexError, v } from "convex/values";

import { fixedEventFields, planningFields } from "@gc/db";
import {
  dayBounds,
  overlaps,
  placementConflicts,
  validatePlanning,
} from "@gc/validators";

import { taskQueries } from "./dbQueries";
import { authedMutation, authedQuery } from "./utils/authedFunctions";
import { autoPlan } from "./utils/autoPlan";
import { resolveOccurrence } from "./utils/recurrence";

export const scheduleTask = authedMutation({
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

export const planDay = authedMutation({
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
    if (!state?.changes.length) return;
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
    });
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

export const saveSettings = authedMutation({
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
  args: {},
  handler: async (ctx) =>
    (
      await ctx.db
        .query("fixedEvents")
        .withIndex("by_user_start", (q) => q.eq("userId", ctx.userId))
        .collect()
    ).filter((event) => event.deletedAt === undefined),
});

export const saveEvent = authedMutation({
  args: { eventId: v.optional(v.id("fixedEvents")), ...fixedEventFields },
  rateLimit: { name: "saveEvent" },
  handler: async (ctx, { eventId, ...event }) => {
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
      await ctx.db.patch(eventId, values);
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

export const deleteEvent = authedMutation({
  args: { eventId: v.id("fixedEvents") },
  rateLimit: { name: "deleteEvent" },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
    if (!event || event.userId !== ctx.userId)
      throw new ConvexError({ message: "Event not found" });
    await ctx.db.patch(eventId, { deletedAt: Date.now() });
    await autoPlan(ctx);
  },
});
