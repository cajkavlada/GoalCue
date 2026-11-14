import { ConvexError, v } from "convex/values";

import { placementConflicts } from "@gc/validators";

import { taskQueries } from "./dbQueries";
import { authedMutation, authedQuery } from "./utils/authedFunctions";
import { autoPlan } from "./utils/autoPlan";

export const listSessions = authedQuery({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user_start", (q) => q.eq("userId", ctx.userId))
      .collect();
    const visible = await Promise.all(
      sessions
        .filter((session) => session.unscheduledAt === undefined)
        .map(async (session) => {
          const task = await taskQueries({ ctx }).getById({
            taskId: session.taskId,
          });
          return task.archivedAt
            ? null
            : {
                ...session,
                taskTitle: task.title,
                taskCompletedAt: task.completedAt,
              };
        })
    );
    return visible.filter((session) => session !== null);
  },
});

export const saveSession = authedMutation({
  rateLimit: { name: "saveSession" },
  args: {
    sessionId: v.optional(v.id("sessions")),
    taskId: v.id("tasks"),
    startAt: v.number(),
    endAt: v.number(),
    allowConflict: v.optional(v.boolean()),
    automatic: v.optional(v.boolean()),
    pinned: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { sessionId, taskId, startAt, endAt, allowConflict, automatic, pinned }
  ) => {
    const task = await taskQueries({ ctx }).getById({ taskId });
    if (task.archivedAt || task.completedAt)
      throw new ConvexError({ message: "Schedule an active Task" });
    if (
      !Number.isFinite(startAt) ||
      !Number.isFinite(endAt) ||
      endAt <= startAt
    ) {
      throw new ConvexError({ message: "Session end must be after its start" });
    }
    if (!sessionId && startAt < Date.now())
      throw new ConvexError({
        message: "A new Session cannot start in the past",
      });
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
    const conflicts = placementConflicts({ startAt, endAt }, settings, events);
    if (conflicts.length && (automatic || !allowConflict))
      throw new ConvexError({ message: conflicts.join("; ") });
    if (sessionId) {
      const session = await ctx.db.get(sessionId);
      if (
        !session ||
        session.userId !== ctx.userId ||
        session.taskId !== taskId ||
        session.unscheduledAt !== undefined
      ) {
        throw new ConvexError({ message: "Session not found" });
      }
      if (startAt < Date.now() && startAt !== session.startAt)
        throw new ConvexError({
          message: "A Session cannot be moved into the past",
        });
      if (
        automatic &&
        (session.pinned ||
          session.manualOverride ||
          session.startAt <= Date.now())
      )
        throw new ConvexError({
          message: "Preserve pinned, active, and manually placed Sessions",
        });
      await ctx.db.patch(sessionId, {
        startAt,
        endAt,
        pinned: pinned ?? session.pinned,
        manualOverride: !automatic,
        revision: (session.revision ?? 0) + 1,
        automaticReason: undefined,
      });
      await autoPlan(ctx);
      return sessionId;
    }
    const id = await ctx.db.insert("sessions", {
      userId: ctx.userId,
      taskId,
      startAt,
      endAt,
      pinned,
      manualOverride: !automatic,
      revision: 1,
    });
    await autoPlan(ctx);
    return id;
  },
});

export const unscheduleSession = authedMutation({
  rateLimit: { name: "unscheduleSession" },
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== ctx.userId)
      throw new ConvexError({ message: "Session not found" });
    await ctx.db.patch(sessionId, {
      unscheduledAt: Date.now(),
      revision: (session.revision ?? 0) + 1,
    });
    await ctx.db.patch(session.taskId, { automaticSchedulingPaused: true });
    await autoPlan(ctx);
  },
});
