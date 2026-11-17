import { ConvexError } from "convex/values";

import {
  dayBounds,
  localDateTime,
  recurrenceDate,
  recurrenceWindows,
  shiftDate,
  zonedInstant,
} from "@gc/validators";

import { Doc } from "../_generated/dataModel";
import { AuthedMutationCtx } from "./authedFunctions";

export async function resolveOccurrence(
  ctx: AuthedMutationCtx,
  task: Doc<"tasks">,
  instant: number
) {
  if (!task.recurrence) return task;
  const calendar = await getRecurrenceCalendar(ctx);
  const date = localDateTime(instant, calendar.timezone).slice(0, 10);
  const day = dayBounds(date, calendar.timezone);
  await syncOccurrences(ctx, date);
  const occurrences = await ctx.db
    .query("tasks")
    .withIndex("by_series", (q) => q.eq("seriesId", task._id))
    .collect();
  const available = occurrences.filter(
    (o) =>
      o.archivedAt === undefined &&
      o.expiredAt === undefined &&
      o.completedAt === undefined &&
      o.occurrenceStartAt! < day.endAt &&
      (o.occurrenceEndAt === undefined ||
        o.occurrenceEndAt > day.startAt ||
        o.occurrenceCarryForward)
  );
  const candidates = await Promise.all(
    available.map(async (occurrence) => {
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_task", (q) => q.eq("taskId", occurrence._id))
        .collect();
      return {
        occurrence,
        planned: sessions
          .filter((s) => s.unscheduledAt === undefined)
          .reduce((sum, s) => sum + s.endAt - s.startAt, 0),
      };
    })
  );
  candidates.sort(
    (a, b) =>
      Number(a.occurrence.occurrenceEndAt! <= day.startAt) -
        Number(b.occurrence.occurrenceEndAt! <= day.startAt) ||
      a.planned - b.planned ||
      a.occurrence.occurrenceStartAt! - b.occurrence.occurrenceStartAt! ||
      a.occurrence._id.localeCompare(b.occurrence._id)
  );
  if (!candidates[0])
    throw new ConvexError({
      message:
        "This series has no unfinished Occurrence on the selected day. Choose another day or edit its recurrence.",
    });
  return candidates[0].occurrence;
}

export async function getRecurrenceCalendar(
  ctx: AuthedMutationCtx,
  initialTimezone?: string
) {
  const settings = await ctx.db
    .query("planningSettings")
    .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
    .first();
  if (settings)
    return {
      timezone: settings.timezone,
      weekStartsOn: settings.weekStartsOn ?? 1,
    };
  const plan = await ctx.db
    .query("dayPlans")
    .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
    .first();
  const calendar = {
    timezone: plan?.timezone ?? initialTimezone ?? "UTC",
    weekStartsOn: 1,
  };
  new Intl.DateTimeFormat("en", { timeZone: calendar.timezone });
  await ctx.db.insert("planningSettings", {
    userId: ctx.userId,
    ...calendar,
    weekly: [],
    overrides: [],
    protectedWeekly: [],
    protectedDates: [],
  });
  return calendar;
}

export async function syncOccurrences(
  ctx: AuthedMutationCtx,
  through?: string
) {
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_user_priority", (q) => q.eq("userId", ctx.userId))
    .collect();
  const now = Date.now();
  const seriesTasks = tasks.filter(
    (t) => t.recurrence && t.archivedAt === undefined
  );
  if (!seriesTasks.length) return;
  const calendar = await getRecurrenceCalendar(ctx);
  for (const series of seriesTasks) {
    const rule = { ...series.recurrence!, ...calendar };
    const calendarChanged =
      series.recurrence!.timezone !== calendar.timezone ||
      series.recurrence!.weekStartsOn !== calendar.weekStartsOn;
    if (calendarChanged) await ctx.db.patch(series._id, { recurrence: rule });
    series.recurrence = rule;
    const today = localDateTime(now, rule.timezone).slice(0, 10);
    const horizon = shiftDate(today, 7);
    const occurrences = tasks.filter((t) => t.seriesId === series._id);
    if (rule.kind === "completion") {
      const ordered = [];
      for (const occurrence of [...occurrences].sort(
        (a, b) => a.occurrenceStartAt! - b.occurrenceStartAt!
      )) {
        if (occurrence.archivedAt !== undefined) continue;
        const previous = occurrence.occurrencePreviousId
          ? ordered.find((o) => o._id === occurrence.occurrencePreviousId)
          : undefined;
        if (
          occurrence.occurrencePreviousId &&
          (!previous ||
            previous.completedAt === undefined ||
            previous.completedAt !== occurrence.occurrencePreviousCompletedAt)
        ) {
          await ctx.db.patch(occurrence._id, { archivedAt: now });
          const sessions = await ctx.db
            .query("sessions")
            .withIndex("by_task", (q) => q.eq("taskId", occurrence._id))
            .collect();
          for (const session of sessions)
            if (session.startAt > now && session.unscheduledAt === undefined)
              await ctx.db.patch(session._id, {
                unscheduledAt: now,
                revision: (session.revision ?? 0) + 1,
              });
          continue;
        }
        ordered.push(occurrence);
        if (
          occurrence.completedAt === undefined &&
          occurrence.occurrenceStartAt! > now &&
          !occurrence.occurrenceException &&
          (calendarChanged ||
            occurrence.occurrenceTimezone !== calendar.timezone)
        ) {
          const completed =
            previous?.completedAt === undefined
              ? undefined
              : localDateTime(previous.completedAt, calendar.timezone);
          const date = completed
            ? recurrenceDate(completed.slice(0, 10), rule.unit, rule.interval)
            : rule.startDate;
          await ctx.db.patch(occurrence._id, {
            occurrenceStartAt: zonedInstant(
              `${date}T${completed?.slice(11) ?? rule.time}`,
              calendar.timezone,
              "earlier",
              "forward"
            ),
            occurrenceTimezone: calendar.timezone,
          });
        }
      }
      const last = ordered[ordered.length - 1];
      if (last && last.completedAt === undefined) continue;
      if (rule.endAfter !== undefined && ordered.length >= rule.endAfter)
        continue;
      const completed = last
        ? localDateTime(last.completedAt!, rule.timezone)
        : undefined;
      const date = completed
        ? recurrenceDate(completed.slice(0, 10), rule.unit, rule.interval)
        : rule.startDate;
      if (
        (date > horizon && (!through || date > shiftDate(through, 7))) ||
        (rule.endDate && date > rule.endDate)
      )
        continue;
      await createOccurrence(ctx, series, {
        key: String(ordered.length),
        startAt: zonedInstant(
          `${date}T${completed?.slice(11) ?? rule.time}`,
          rule.timezone,
          "earlier",
          "forward"
        ),
        previousId: last?._id,
        previousCompletedAt: last?.completedAt,
      });
      continue;
    }
    for (const occurrence of occurrences) {
      if (
        occurrence.completedAt === undefined &&
        occurrence.expiredAt === undefined &&
        occurrence.occurrenceEndAt! <= now &&
        !occurrence.occurrenceCarryForward
      ) {
        await ctx.db.patch(occurrence._id, {
          expiredAt: now,
          automaticSchedulingPaused: occurrence.leisure
            ? occurrence.automaticSchedulingPaused
            : true,
        });
        const sessions = await ctx.db
          .query("sessions")
          .withIndex("by_task", (q) => q.eq("taskId", occurrence._id))
          .collect();
        for (const session of sessions)
          if (
            session.startAt > now &&
            session.unscheduledAt === undefined &&
            !session.recoveryRequestId
          )
            await ctx.db.patch(session._id, {
              unscheduledAt: now,
              revision: (session.revision ?? 0) + 1,
            });
      }
    }
    const windows = recurrenceWindows(rule, today, horizon);
    if (through && through > horizon)
      windows.push(...recurrenceWindows(rule, through, shiftDate(through, 7)));
    for (const window of new Map(
      windows.map((window) => [window.key, window])
    ).values()) {
      const key = `${series.recurrenceRevision ?? 0}:${window.key}`;
      if (window.startAt < (series.recurrenceFromAt ?? -Infinity)) continue;
      const existing = occurrences.find((o) => o.occurrenceKey === key);
      if (
        existing &&
        existing.archivedAt === undefined &&
        existing.completedAt === undefined &&
        !existing.occurrenceException &&
        existing.occurrenceStartAt! > now &&
        (existing.occurrenceStartAt !== window.startAt ||
          existing.occurrenceEndAt !== window.endAt ||
          existing.occurrenceTimezone !== calendar.timezone)
      ) {
        await ctx.db.patch(existing._id, {
          occurrenceStartAt: window.startAt,
          occurrenceEndAt: window.endAt,
          occurrenceTimezone: calendar.timezone,
        });
      }
      if (
        !occurrences.some(
          (o) =>
            o.occurrenceKey === key ||
            (o.occurrenceException &&
              o.occurrenceKey?.endsWith(`:${window.key}`))
        )
      )
        await createOccurrence(ctx, series, { ...window, key });
    }
  }
}

async function createOccurrence(
  ctx: AuthedMutationCtx,
  series: Doc<"tasks">,
  window: {
    key: string;
    startAt: number;
    endAt?: number;
    previousId?: Doc<"tasks">["_id"];
    previousCompletedAt?: number;
  }
) {
  const {
    _id,
    _creationTime,
    recurrence,
    completedAt: _completedAt,
    archivedAt: _archivedAt,
    ...values
  } = series;
  const volume = recurrence!.kind === "volume";
  const id = await ctx.db.insert("tasks", {
    ...values,
    seriesId: _id,
    occurrenceKey: window.key,
    occurrenceStartAt: window.startAt,
    occurrenceTimezone: recurrence!.timezone,
    occurrenceEndAt: window.endAt,
    occurrenceCarryForward: recurrence!.carryForward,
    occurrencePreviousId: window.previousId,
    occurrencePreviousCompletedAt: window.previousCompletedAt,
    currentNumValue: values.initialNumValue,
    currentEnumOptionId: (await ctx.db.get(series.taskTypeId))
      ?.initialEnumOptionId,
    ...(volume
      ? {
          valueKind: "number" as const,
          initialNumValue: 0,
          currentNumValue: 0,
          completedNumValue: recurrence!.volume,
        }
      : {}),
  });
  const tags = await ctx.db
    .query("tagTasks")
    .withIndex("by_taskId", (q) => q.eq("taskId", _id))
    .collect();
  for (const tag of tags)
    await ctx.db.insert("tagTasks", { taskId: id, tagId: tag.tagId });
  return id;
}
