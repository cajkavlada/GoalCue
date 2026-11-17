import { localDateTime, planSessions } from "@gc/validators";

import { Doc, Id } from "../_generated/dataModel";
import { AuthedMutationCtx } from "./authedFunctions";
import { syncOccurrences } from "./recurrence";

export async function autoPlan(
  ctx: AuthedMutationCtx,
  selection?: { date: string; timezone: string; replanAll?: boolean }
) {
  await syncOccurrences(ctx, selection?.date);
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
  const recoveryRequests = await ctx.db
    .query("recoveryRequests")
    .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
    .collect();
  const result = planSessions({
    recoveryRequests,
    projects: await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect(),
    date,
    now,
    replanAll: selection?.replanAll,
    tasks: tasks.filter((t) => !t.recurrence),
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
  const requestIds = new Map<string, Id<"recoveryRequests">>();
  const recoveryUndo: NonNullable<Doc<"dayPlans">["recoveryUndo"]> = [];
  for (const request of result.recoveries) {
    const { _id, ...fields } = request;
    const values = {
      ...fields,
      taskId: fields.taskId as Id<"tasks"> | undefined,
    };
    const previous = recoveryRequests.find((r) => r._id === _id);
    const allocations = previous?.allocations ?? [];
    const changed =
      !previous ||
      JSON.stringify(allocations) !== JSON.stringify(request.allocations);
    const revision = (previous?.revision ?? 0) + 1;
    if (_id.startsWith("new:")) {
      requestIds.set(
        _id,
        await ctx.db.insert("recoveryRequests", {
          userId: ctx.userId,
          ...values,
          revision,
        })
      );
    } else {
      const id = _id as Id<"recoveryRequests">;
      requestIds.set(_id, id);
      if (changed)
        await ctx.db.patch(id, { allocations: request.allocations, revision });
    }
    if (changed)
      recoveryUndo.push({
        requestId: requestIds.get(_id)!,
        created: !previous,
        revision,
        allocations,
        sessionIds: [],
      });
  }
  for (const placement of result.recoveryPlacements) {
    const sessionId = await ctx.db.insert("sessions", {
      userId: ctx.userId,
      taskId: placement.taskId as Id<"tasks">,
      recoveryRequestId: requestIds.get(placement.requestId)!,
      startAt: placement.startAt,
      endAt: placement.endAt,
      automaticReason: "Restore displaced leisure opportunity",
      manualOverride: false,
      revision: 1,
    });
    recoveryUndo
      .find((r) => r.requestId === requestIds.get(placement.requestId))!
      .sessionIds.push(sessionId);
  }
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
    recoveryUndo:
      changes.length || recoveryUndo.length
        ? recoveryUndo
        : state?.recoveryUndo,
    date,
    timezone,
    changes:
      changes.length || recoveryUndo.length ? changes : (state?.changes ?? []),
    shortfalls: result.shortfalls.map((s) => ({
      ...s,
      taskId: s.taskId as Id<"tasks">,
    })),
    conflicts: [
      ...result.conflicts,
      ...(result.recoveryImbalance
        ? [
            "Repeated leisure displacement or reserve borrowing: review workload, deadlines, or protected leisure time",
          ]
        : []),
    ],
    projectShortfalls: result.projectShortfalls.map((s) => ({
      ...s,
      projectId: s.projectId as Id<"projects">,
    })),
  };
  if (state) await ctx.db.patch(state._id, values);
  else await ctx.db.insert("dayPlans", { userId: ctx.userId, ...values });
}
