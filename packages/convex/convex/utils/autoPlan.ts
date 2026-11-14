import { localDateTime, planSessions } from "@gc/validators";

import { Doc, Id } from "../_generated/dataModel";
import { AuthedMutationCtx } from "./authedFunctions";

export async function autoPlan(
  ctx: AuthedMutationCtx,
  selection?: { date: string; timezone: string; replanAll?: boolean }
) {
  const state = await ctx.db
    .query("dayPlans")
    .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
    .first();
  if (!state && !selection) return;
  const settings = await ctx.db
    .query("planningSettings")
    .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
    .first();
  const timezone = settings?.timezone ?? selection?.timezone ?? state!.timezone;
  const now = Date.now();
  const today = localDateTime(now, timezone).slice(0, 10);
  const date = selection?.date ?? (state!.date < today ? today : state!.date);
  const [tasks, sessions, events] = await Promise.all([
    ctx.db
      .query("tasks")
      .withIndex("by_user_priority", (q) => q.eq("userId", ctx.userId))
      .collect(),
    ctx.db
      .query("sessions")
      .withIndex("by_user_start", (q) => q.eq("userId", ctx.userId))
      .collect(),
    ctx.db
      .query("fixedEvents")
      .withIndex("by_user_start", (q) => q.eq("userId", ctx.userId))
      .collect(),
  ]);
  if (selection?.replanAll) {
    for (const task of tasks) {
      if (
        task.archivedAt === undefined &&
        task.completedAt === undefined &&
        task.effortMinutes !== undefined &&
        task.automaticSchedulingPaused
      ) {
        await ctx.db.patch(task._id, { automaticSchedulingPaused: false });
        task.automaticSchedulingPaused = false;
      }
    }
  }
  const result = planSessions({
    date,
    now,
    replanAll: selection?.replanAll,
    tasks,
    sessions,
    events: events.filter((e) => e.deletedAt === undefined),
    settings: settings ?? {
      timezone,
      weekly: [],
      overrides: [],
      protectedWeekly: [],
      protectedDates: [],
    },
  });
  const changes: Doc<"dayPlans">["changes"] = [];
  for (const change of result.changes) {
    const taskId = change.taskId as Id<"tasks">;
    const previous = sessions.find((s) => s._id === change.id);
    const revision = (previous?.revision ?? 0) + 1;
    const values = {
      ...change.after,
      revision,
      automaticReason: change.reason,
      manualOverride: false,
      unscheduledAt: change.after ? undefined : now,
    };
    let sessionId: Id<"sessions">;
    if (previous) {
      sessionId = previous._id;
      await ctx.db.patch(sessionId, values);
    } else {
      sessionId = await ctx.db.insert("sessions", {
        userId: ctx.userId,
        taskId,
        ...values,
        ...change.after!,
      });
    }
    changes.push({
      sessionId,
      taskId,
      title: tasks.find((t) => t._id === taskId)!.title,
      before: change.before,
      after: change.after,
      revision,
      reason: change.reason,
    });
  }
  const values = {
    date,
    timezone,
    changes: changes.length ? changes : (state?.changes ?? []),
    shortfalls: result.shortfalls.map((s) => ({
      ...s,
      taskId: s.taskId as Id<"tasks">,
    })),
    conflicts: result.conflicts,
  };
  if (state) await ctx.db.patch(state._id, values);
  else await ctx.db.insert("dayPlans", { userId: ctx.userId, ...values });
}
