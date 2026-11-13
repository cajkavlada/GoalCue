import { ConvexError, v } from "convex/values";

import { taskQueries } from "./dbQueries";
import { authedMutation, authedQuery } from "./utils/authedFunctions";

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
          return task.archivedAt ? null : { ...session, taskTitle: task.title };
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
  },
  handler: async (ctx, { sessionId, taskId, startAt, endAt }) => {
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
      await ctx.db.patch(sessionId, { startAt, endAt });
      return sessionId;
    }
    return await ctx.db.insert("sessions", {
      userId: ctx.userId,
      taskId,
      startAt,
      endAt,
    });
  },
});

export const unscheduleSession = authedMutation({
  rateLimit: { name: "unscheduleSession" },
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== ctx.userId)
      throw new ConvexError({ message: "Session not found" });
    await ctx.db.patch(sessionId, { unscheduledAt: Date.now() });
  },
});
