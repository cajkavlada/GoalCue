import { ConvexError, Infer, v } from "convex/values";

import {
  localDateTime,
  locationConflicts,
  overlaps,
  placementConflicts,
  supportsBatchCheckIn,
} from "@gc/validators";

import { Doc, Id } from "./_generated/dataModel";
import { taskQueries } from "./dbQueries";
import {
  authedMutation,
  AuthedMutationCtx,
  authedQuery,
  AuthedQueryCtx,
} from "./utils/authedFunctions";
import { autoPlan } from "./utils/autoPlan";
import { resolveOccurrence } from "./utils/recurrence";

async function progressDetails(
  ctx: AuthedQueryCtx,
  task: Doc<"tasks">
): Promise<Pick<Doc<"tasks">, "progressMeasure" | "progressUnit">> {
  if (task.progressMeasure)
    return {
      progressMeasure: task.progressMeasure,
      progressUnit: task.progressUnit,
    };
  if (task.valueKind !== "number") return {};
  const taskType = await ctx.db.get(task.taskTypeId);
  const unit = taskType?.unitId ? await ctx.db.get(taskType.unitId) : null;
  return {
    progressMeasure:
      unit?.i18nKey === "units_percent"
        ? "percentage"
        : unit?.i18nKey === "units_minute"
          ? "time"
          : "quantity",
    progressUnit: unit?.symbol || unit?.name,
  };
}

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
                attendance: task.attendance,
                hybridAttendance: task.hybridAttendance,
                locationRequirement: task.locationRequirement,
                projectId: task.projectId,
                seriesId: task.seriesId,
                taskCompletedAt: task.completedAt,
                ...(await progressDetails(ctx, task)),
              };
        })
    );
    return visible.filter((session) => session !== null);
  },
});

export const requestCheckIn = authedMutation({
  args: { sessionId: v.id("sessions") },
  rateLimit: { name: "requestCheckIn" },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (
      !session ||
      session.userId !== ctx.userId ||
      session.unscheduledAt !== undefined
    )
      throw new ConvexError({ message: "Session not found" });
    const task = await taskQueries({ ctx }).getById({ taskId: session.taskId });
    if (
      task.archivedAt !== undefined ||
      task.completedAt !== undefined ||
      session.checkIn
    )
      throw new ConvexError({
        message: "Choose an unresolved Session of an active Task",
      });
    await ctx.db.patch(sessionId, {
      checkInRequestedAt: Date.now(),
      askAfter: undefined,
    });
  },
});

const checkInFields = {
  sessionId: v.id("sessions"),
  outcome: v.union(
    v.literal("finished"),
    v.literal("progress"),
    v.literal("missed"),
    v.literal("working"),
    v.literal("later"),
    v.literal("undo")
  ),
  value: v.optional(v.number()),
  timeMinutes: v.optional(v.number()),
  remainingMinutes: v.optional(v.number()),
  extensionMinutes: v.optional(v.number()),
};
const checkInSchema = v.object(checkInFields);

export const reportCheckIn = authedMutation({
  rateLimit: { name: "reportCheckIn" },
  args: checkInSchema,
  handler: (ctx, args) => applyCheckIn(ctx, args),
});

async function applyCheckIn(
  ctx: AuthedMutationCtx,
  {
    sessionId,
    outcome,
    value,
    timeMinutes,
    remainingMinutes,
    extensionMinutes,
  }: Infer<typeof checkInSchema>,
  replan = true
) {
  const session = await ctx.db.get(sessionId);
  if (
    !session ||
    session.userId !== ctx.userId ||
    session.unscheduledAt !== undefined
  )
    throw new ConvexError({ message: "Session not found" });
  const task = await taskQueries({ ctx }).getById({ taskId: session.taskId });
  const { progressMeasure } = await progressDetails(ctx, task);
  if (task.archivedAt !== undefined)
    throw new ConvexError({ message: "Check in on an active Task" });
  const now = Date.now();
  if (session.startAt > now && session.checkInRequestedAt === undefined)
    throw new ConvexError({ message: "The Session has not started" });
  for (const number of [value, timeMinutes, remainingMinutes, extensionMinutes])
    if (number !== undefined && (!Number.isFinite(number) || number < 0))
      throw new ConvexError({
        message: "Enter finite, nonnegative progress and minutes",
      });
  if (outcome === "later") {
    await ctx.db.patch(sessionId, { askAfter: now + 30 * 60000 });
    return;
  }
  if (outcome === "working") {
    if (!extensionMinutes || extensionMinutes > 1440)
      throw new ConvexError({
        message: "Choose an extension of up to 1440 minutes",
      });
    const endAt = Math.max(now, session.endAt) + extensionMinutes * 60000;
    if (
      !task.occurrenceCarryForward &&
      task.occurrenceEndAt !== undefined &&
      endAt > task.occurrenceEndAt
    )
      throw new ConvexError({
        message: "Keep the extension within its Occurrence period",
      });
    const extension = { startAt: session.endAt, endAt };
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
    const conflicts = [
      ...placementConflicts(extension, settings, events),
      ...locationConflicts(extension, task, events),
    ];
    if (
      sessions.some(
        (s) =>
          s._id !== sessionId &&
          s.unscheduledAt === undefined &&
          overlaps(s, extension) &&
          (s.pinned || s.manualOverride !== false || s.startAt <= now)
      )
    )
      conflicts.push("Pinned, active, or manually placed Session");
    if (
      task.finishKind !== "preferred" &&
      task.dueAt !== undefined &&
      endAt > task.dueAt
    )
      conflicts.push("Firm deadline");
    if (conflicts.length)
      throw new ConvexError({
        message: `${conflicts.join("; ")}. Choose a shorter extension or report progress and plan the remainder.`,
      });
    if (session.checkIn)
      throw new ConvexError({
        message: "Undo the resolved check-in before extending",
      });
    await ctx.db.patch(sessionId, {
      endAt,
      askAfter: undefined,
      checkInRequestedAt: undefined,
      revision: (session.revision ?? 0) + 1,
    });
    if (replan) await autoPlan(ctx);
    return;
  }
  if (
    outcome === "progress" &&
    progressMeasure &&
    progressMeasure !== "done" &&
    value === undefined
  )
    throw new ConvexError({
      message: "Enter progress in the Task's measure",
    });
  if (progressMeasure === "percentage" && value !== undefined && value > 100)
    throw new ConvexError({
      message: "Percentage must be between 0 and 100",
    });
  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_task", (q) => q.eq("taskId", task._id))
    .collect();
  const reports = sessions
    .filter(
      (s) =>
        s.checkIn &&
        (s.checkIn.measure === progressMeasure ||
          (!task.progressMeasure && s.checkIn.measure === undefined))
    )
    .sort(
      (a, b) =>
        a.checkIn!.reportedAt - b.checkIn!.reportedAt ||
        a._id.localeCompare(b._id)
    );
  const previous = session.checkIn;
  if (outcome === "undo" && !previous) return;
  if (
    previous &&
    previous.measure !== progressMeasure &&
    (task.progressMeasure || previous.measure !== undefined)
  )
    throw new ConvexError({
      message:
        "The progress measure changed; correct the Task's progress directly",
    });
  const baseline =
    (task.currentNumValue ?? 0) -
    reports.reduce((sum, s) => sum + s.checkIn!.contribution, 0);
  const report =
    outcome === "undo"
      ? undefined
      : {
          outcome,
          reportedAt: previous?.reportedAt ?? now,
          measure: progressMeasure,
          value: outcome === "progress" ? value : undefined,
          contribution: 0,
          completedAt: previous?.completedAt,
          timeMinutes: outcome === "missed" ? 0 : (timeMinutes ?? 0),
          remainingMinutes: outcome === "missed" ? undefined : remainingMinutes,
          previousCompletedAt: previous
            ? previous.previousCompletedAt
            : task.completedAt,
        };
  const updated = sessions
    .map((s) => (s._id === sessionId ? { ...s, checkIn: report } : s))
    .filter(
      (s) =>
        s.checkIn &&
        (s.checkIn.measure === progressMeasure ||
          (!task.progressMeasure && s.checkIn.measure === undefined))
    )
    .sort(
      (a, b) =>
        a.checkIn!.reportedAt - b.checkIn!.reportedAt ||
        a._id.localeCompare(b._id)
    );
  let current = baseline;
  for (const s of updated) {
    const r = s.checkIn!;
    const next =
      r.outcome === "finished" && task.valueKind === "number"
        ? (task.completedNumValue ?? current)
        : r.outcome === "progress" && r.value !== undefined
          ? r.measure === "percentage"
            ? r.value
            : current + r.value
          : current;
    r.contribution = next - current;
    current = next;
  }
  const reachedTarget =
    task.valueKind === "number" &&
    task.completedNumValue !== undefined &&
    (task.completedNumValue >= (task.initialNumValue ?? 0)
      ? current >= task.completedNumValue
      : current <= task.completedNumValue);
  const finished =
    updated.some((s) => s.checkIn!.outcome === "finished") || reachedTarget;
  const completionOwner = reports.find(
    (s) =>
      s.checkIn!.completedAt !== undefined &&
      s.checkIn!.completedAt === task.completedAt
  )?.checkIn;
  const ownsCompletion = completionOwner !== undefined;
  const completedAt = finished
    ? (task.completedAt ?? now)
    : ownsCompletion
      ? completionOwner.previousCompletedAt
      : task.completedAt;
  const reportCompletedAt =
    finished && (task.completedAt === undefined || ownsCompletion)
      ? completedAt
      : undefined;
  for (const s of updated) {
    s.checkIn!.completedAt =
      s === updated[updated.length - 1] ? reportCompletedAt : undefined;
    if (ownsCompletion)
      s.checkIn!.previousCompletedAt = completionOwner.previousCompletedAt;
    if (s._id !== sessionId) await ctx.db.patch(s._id, { checkIn: s.checkIn });
  }
  await ctx.db.patch(task._id, {
    currentNumValue:
      task.valueKind === "number" ? current : task.currentNumValue,
    completedAt,
  });
  await ctx.db.patch(sessionId, {
    checkIn: updated.find((s) => s._id === sessionId)?.checkIn,
    askAfter: undefined,
    checkInUpdatedAt: now,
    planningEffortMinutes:
      session.planningEffortMinutes ??
      (task.effortMinutes === undefined
        ? (sessions.find((s) => s.planningEffortMinutes !== undefined)
            ?.planningEffortMinutes ??
          sessions
            .filter((s) => s.unscheduledAt === undefined)
            .reduce((sum, s) => sum + (s.endAt - s.startAt) / 60000, 0))
        : undefined),
  });
  if (replan) await autoPlan(ctx);
}

function progressSnapshot(task: Doc<"tasks">) {
  return {
    currentNumValue: task.currentNumValue,
    completedAt: task.completedAt,
  };
}

function sessionSnapshot(session: Doc<"sessions">) {
  return {
    userId: session.userId,
    taskId: session.taskId,
    startAt: session.startAt,
    endAt: session.endAt,
    unscheduledAt: session.unscheduledAt,
    pinned: session.pinned,
    manualOverride: session.manualOverride,
    revision: session.revision,
    automaticReason: session.automaticReason,
    askAfter: session.askAfter,
    checkInRequestedAt: session.checkInRequestedAt,
    checkInUpdatedAt: session.checkInUpdatedAt,
    planningEffortMinutes: session.planningEffortMinutes,
    recoveryRequestId: session.recoveryRequestId,
    checkIn: session.checkIn ? { ...session.checkIn } : undefined,
  };
}

function sameValues(a: unknown, b: unknown) {
  const stringify = (value: unknown) =>
    JSON.stringify(value, (_key, item) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? Object.fromEntries(
            Object.entries(item).sort(([left], [right]) =>
              left.localeCompare(right)
            )
          )
        : item
    );
  return stringify(a) === stringify(b);
}

export const batchCheckIn = authedMutation({
  args: {
    sessionIds: v.array(v.id("sessions")),
    outcome: v.union(
      v.literal("finished"),
      v.literal("missed"),
      v.literal("later")
    ),
  },
  rateLimit: { name: "batchCheckIn" },
  handler: async (ctx, { sessionIds, outcome }) => {
    const ids = [...new Set(sessionIds)];
    if (!ids.length)
      throw new ConvexError({ message: "Select Sessions first" });
    const now = Date.now();
    const selected = [];
    const tasks = new Map<Id<"tasks">, ReturnType<typeof progressSnapshot>>();
    for (const id of ids) {
      const session = await ctx.db.get(id);
      if (
        !session ||
        session.userId !== ctx.userId ||
        session.unscheduledAt !== undefined
      )
        throw new ConvexError({ message: "Session not found" });
      const task = await taskQueries({ ctx }).getById({
        taskId: session.taskId,
      });
      if (
        !supportsBatchCheckIn(
          {
            ...session,
            taskCompletedAt: task.completedAt,
            taskArchivedAt: task.archivedAt,
          },
          now
        )
      )
        throw new ConvexError({
          message:
            "This action is not supported by every selected Session; refresh your selection",
        });
      selected.push(session);
      tasks.set(task._id, progressSnapshot(task));
    }
    const before = new Map(
      (
        await ctx.db
          .query("sessions")
          .withIndex("by_user_start", (q) => q.eq("userId", ctx.userId))
          .collect()
      ).map((session) => [session._id, sessionSnapshot(session)])
    );
    const completed = new Map<Id<"tasks">, Doc<"sessions">["checkIn"]>();
    for (const session of selected) {
      if (outcome === "finished" && completed.has(session.taskId)) {
        await ctx.db.patch(session._id, {
          checkIn: {
            ...completed.get(session.taskId)!,
            contribution: 0,
            completedAt: undefined,
            previousCompletedAt: tasks.get(session.taskId)!.completedAt,
          },
          askAfter: undefined,
          checkInUpdatedAt: now,
        });
      } else {
        await applyCheckIn(ctx, { sessionId: session._id, outcome }, false);
        if (outcome === "finished")
          completed.set(
            session.taskId,
            (await ctx.db.get(session._id))!.checkIn
          );
      }
    }
    if (outcome !== "later") await autoPlan(ctx);
    const after = await ctx.db
      .query("sessions")
      .withIndex("by_user_start", (q) => q.eq("userId", ctx.userId))
      .collect();
    return ctx.db.insert("checkInBatches", {
      userId: ctx.userId,
      outcome,
      tasks: await Promise.all(
        [...tasks].map(async ([taskId, value]) => ({
          taskId,
          before: value,
          after: progressSnapshot((await ctx.db.get(taskId))!),
        }))
      ),
      sessions: after
        .filter(
          (session) =>
            !sameValues(before.get(session._id), sessionSnapshot(session))
        )
        .map((session) => ({
          sessionId: session._id,
          before: before.get(session._id),
          after: sessionSnapshot(session),
        })),
    });
  },
});

export const getLastCheckInBatch = authedQuery({
  args: {},
  handler: async (ctx) => {
    const batch = await ctx.db
      .query("checkInBatches")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .order("desc")
      .first();
    return batch ? { batchId: batch._id, undoneAt: batch.undoneAt } : null;
  },
});

export const undoBatchCheckIn = authedMutation({
  args: { batchId: v.id("checkInBatches") },
  rateLimit: { name: "undoBatchCheckIn" },
  handler: async (ctx, { batchId }) => {
    const batch = await ctx.db.get(batchId);
    if (!batch || batch.userId !== ctx.userId)
      throw new ConvexError({ message: "Batch not found" });
    if (batch.undoneAt !== undefined) return;
    const now = Date.now();
    for (const change of batch.tasks) {
      const task = await taskQueries({ ctx }).getById({
        taskId: change.taskId,
      });
      if (!sameValues(progressSnapshot(task), change.after))
        throw new ConvexError({
          message:
            "Task progress changed after this batch; correct the affected Sessions individually",
        });
    }
    const [settings, events, sessions] = await Promise.all([
      ctx.db
        .query("planningSettings")
        .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
        .first(),
      ctx.db
        .query("fixedEvents")
        .withIndex("by_user_start", (q) => q.eq("userId", ctx.userId))
        .collect(),
      ctx.db
        .query("sessions")
        .withIndex("by_user_start", (q) => q.eq("userId", ctx.userId))
        .collect(),
    ]);
    const affected = new Set(batch.sessions.map((change) => change.sessionId));
    for (const change of batch.sessions) {
      const session = sessions.find((s) => s._id === change.sessionId);
      if (!session || !sameValues(sessionSnapshot(session), change.after))
        throw new ConvexError({
          message:
            "A Session changed after this batch; correct it individually",
        });
      const before = change.before;
      const scheduleChanged =
        !before ||
        before.startAt !== change.after.startAt ||
        before.endAt !== change.after.endAt ||
        before.unscheduledAt !== change.after.unscheduledAt;
      const owner =
        before && scheduleChanged ? await ctx.db.get(before.taskId) : null;
      if (
        scheduleChanged &&
        before?.unscheduledAt === undefined &&
        before &&
        (before.startAt <= now ||
          (owner?.dueAt !== undefined &&
            owner.finishKind !== "preferred" &&
            before.endAt > owner.dueAt) ||
          placementConflicts(
            before,
            settings,
            events.filter((e) => e.deletedAt === undefined)
          ).length ||
          (owner &&
            locationConflicts(
              before,
              owner,
              events.filter((e) => e.deletedAt === undefined)
            ).length) ||
          sessions.some(
            (other) =>
              !affected.has(other._id) &&
              other.unscheduledAt === undefined &&
              overlaps(other, before)
          ))
      )
        throw new ConvexError({
          message:
            "The previous schedule is no longer feasible; adjust the affected Sessions individually",
        });
    }
    for (const change of batch.tasks)
      await ctx.db.patch(change.taskId, {
        currentNumValue: change.before.currentNumValue,
        completedAt: change.before.completedAt,
      });
    for (const change of batch.sessions) {
      if (change.before)
        await ctx.db.patch(
          change.sessionId,
          sessionSnapshot({
            ...change.before,
            _id: change.sessionId,
            _creationTime: 0,
          })
        );
      else
        await ctx.db.patch(change.sessionId, {
          unscheduledAt: now,
          revision: (change.after.revision ?? 0) + 1,
        });
    }
    await ctx.db.patch(batchId, { undoneAt: now });
    const state = await ctx.db
      .query("dayPlans")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .first();
    if (state)
      await ctx.db.patch(state._id, {
        changes: state.changes.filter(
          (change) => !affected.has(change.sessionId)
        ),
      });
    await autoPlan(ctx);
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
    if (
      !Number.isFinite(startAt) ||
      !Number.isFinite(endAt) ||
      endAt <= startAt
    )
      throw new ConvexError({ message: "Session end must be after its start" });
    const requested = await taskQueries({ ctx }).getById({ taskId });
    const existingSession = sessionId ? await ctx.db.get(sessionId) : null;
    const recovery =
      existingSession?.recoveryRequestId &&
      existingSession.userId === ctx.userId &&
      existingSession.taskId === taskId;
    if (
      requested.archivedAt ||
      requested.completedAt ||
      (requested.expiredAt !== undefined && !recovery)
    )
      throw new ConvexError({ message: "Schedule an active Task" });
    if (requested.recurrence && sessionId)
      throw new ConvexError({
        message: "Choose the Session's Occurrence to edit it",
      });
    const task = await resolveOccurrence(ctx, requested, startAt);
    taskId = task._id;
    if (requested.recurrence) {
      const existing = await ctx.db
        .query("sessions")
        .withIndex("by_task", (q) => q.eq("taskId", taskId))
        .collect();
      const future = existing.filter(
        (s) =>
          s.unscheduledAt === undefined && s.startAt > Date.now() && !s.checkIn
      );
      sessionId = future
        .filter((s) => !s.pinned)
        .sort((a, b) => a.startAt - b.startAt)[0]?._id;
      if (
        !sessionId &&
        task.effortMinutes !== undefined &&
        future.reduce((sum, s) => sum + (s.endAt - s.startAt) / 60000, 0) >=
          task.effortMinutes
      )
        throw new ConvexError({
          message:
            "This Occurrence is already scheduled in pinned Sessions. Edit its existing Session to move it.",
        });
    }
    if (
      task.seriesId &&
      !recovery &&
      (startAt < task.occurrenceStartAt! ||
        (!task.occurrenceCarryForward &&
          task.occurrenceEndAt !== undefined &&
          endAt > task.occurrenceEndAt))
    )
      throw new ConvexError({
        message: `This Occurrence starts at ${localDateTime(task.occurrenceStartAt!, task.occurrenceTimezone ?? "UTC")}${!task.occurrenceCarryForward && task.occurrenceEndAt !== undefined ? ` and ends at ${localDateTime(task.occurrenceEndAt, task.occurrenceTimezone ?? "UTC")}` : ""} (${task.occurrenceTimezone ?? "UTC"}). Choose a time in that range, or edit the recurrence to allow an earlier start.`,
      });
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
    const conflicts = [
      ...placementConflicts({ startAt, endAt }, settings, events),
      ...locationConflicts({ startAt, endAt }, task, events),
    ];
    if (conflicts.length && (automatic || !allowConflict))
      throw new ConvexError({ message: conflicts.join("; ") });
    if (sessionId) {
      const session = existingSession ?? (await ctx.db.get(sessionId));
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
      const previousPlacement = {
        startAt: session.startAt,
        endAt: session.endAt,
      };
      await ctx.db.patch(sessionId, {
        startAt,
        endAt,
        pinned: pinned ?? session.pinned,
        manualOverride: !automatic,
        revision: (session.revision ?? 0) + 1,
        automaticReason: undefined,
      });
      if (session.recoveryRequestId) {
        const request = (await ctx.db.get(session.recoveryRequestId))!;
        await ctx.db.patch(request._id, {
          revision: (request.revision ?? 0) + 1,
          allocations: request.allocations.map((allocation) =>
            allocation.startAt === previousPlacement.startAt &&
            allocation.endAt === previousPlacement.endAt
              ? { startAt, endAt }
              : allocation
          ),
        });
      }
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
