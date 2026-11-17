import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { generateKeyBetween } from "fractional-indexing";

import {
  createTaskConvexSchema,
  createTaskZodSchema,
  extendedTaskConvexSchema,
  localDateTime,
  recurrenceWindows,
  taskConvexSchema,
  taskWithCorrectValuesSchema,
  updateTaskConvexSchema,
  updateTaskZodSchema,
  validateRecurrence,
  zodParse,
} from "@gc/validators";

import { Doc, Id } from "./_generated/dataModel";
import {
  priorityClassQueries,
  tagQueries,
  tagRelationsUpdate,
  taskQueries,
  taskTypeEnumOptionQueries,
  taskTypeQueries,
} from "./dbQueries";
import {
  authedMutation,
  AuthedMutationCtx,
  authedQuery,
  AuthedQueryCtx,
} from "./utils/authedFunctions";
import { autoPlan } from "./utils/autoPlan";
import { getRecurrenceCalendar } from "./utils/recurrence";

export const listForDayPanel = authedQuery({
  args: {
    search: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { search, paginationOpts }) => {
    const text = search.trim();
    const query = text
      ? ctx.db
          .query("tasks")
          .withSearchIndex("search_title", (q) =>
            q
              .search("title", text)
              .eq("userId", ctx.userId)
              .eq("seriesId", undefined)
              .eq("archivedAt", undefined)
              .eq("completedAt", undefined)
          )
      : ctx.db
          .query("tasks")
          .withIndex("by_user_catalog", (q) =>
            q
              .eq("userId", ctx.userId)
              .eq("seriesId", undefined)
              .eq("archivedAt", undefined)
              .eq("completedAt", undefined)
          );
    const result = await query.paginate({
      ...paginationOpts,
      numItems: Math.min(paginationOpts.numItems, 50),
    });
    return {
      ...result,
      page: result.page.map(
        ({
          _id,
          title,
          effortMinutes,
          priority,
          automaticSchedulingPaused,
          recurrence,
        }) => ({
          _id,
          title,
          effortMinutes,
          priority,
          automaticSchedulingPaused,
          recurring: recurrence !== undefined,
        })
      ),
    };
  },
});

export const listUncompletedExtended = authedQuery({
  args: {},
  returns: v.array(extendedTaskConvexSchema),
  handler: async (ctx) => {
    const tasks = await taskQueries({ ctx }).listByStatus({
      completedAfter: undefined,
    });

    const extendedTasks = await Promise.all(
      tasks.map(async (task) => {
        return await getExtendedTaskInfo(ctx, task);
      })
    );
    return extendedTasks;
  },
});

export const listRecentlyCompletedExtended = authedQuery({
  args: { completedAfter: v.number() },
  returns: v.array(extendedTaskConvexSchema),
  handler: async (ctx, { completedAfter }) => {
    const tasks = await taskQueries({ ctx }).listByStatus({
      completedAfter,
    });

    const extendedTasks = await Promise.all(
      tasks
        .filter((task) => !task.recurrence)
        .map(async (task) => {
          return await getExtendedTaskInfo(ctx, task);
        })
    );
    return extendedTasks;
  },
});

export const getExtendedById = authedQuery({
  args: {
    taskId: taskConvexSchema._id,
  },
  returns: extendedTaskConvexSchema,
  handler: async (ctx, { taskId }) => {
    const task = await taskQueries({ ctx }).getById({ taskId });
    return await getExtendedTaskInfo(ctx, task);
  },
});

export const create = authedMutation({
  args: createTaskConvexSchema,
  rateLimit: { name: "createTask" },
  handler: async (ctx, input) => {
    Object.assign(input, await volumeProgress(ctx, input, input.taskTypeId));
    if (input.recurrence) {
      input.recurrence = {
        ...input.recurrence,
        ...(await getRecurrenceCalendar(ctx, input.recurrence.timezone)),
      };
      validateRecurrence(input.recurrence);
      if (
        input.recurrence.kind === "volume" &&
        input.progressMeasure !== "time" &&
        input.progressMeasure !== "quantity"
      )
        throw new ConvexError({
          message: "A volume target needs time or quantity progress",
        });
    }
    const taskArgs = { ...input, ...progressValues(input) };
    if (input.recurrence?.kind === "volume")
      taskArgs.completedNumValue = input.recurrence.volume;
    const parsedDueAt = taskArgs.dueAt ? new Date(taskArgs.dueAt) : undefined;
    zodParse(createTaskZodSchema, {
      ...taskArgs,
      dueAt: parsedDueAt,
    });

    const taskType = await taskTypeQueries({ ctx }).getById({
      taskTypeId: taskArgs.taskTypeId,
    });

    const valueKind = taskArgs.progressMeasure
      ? taskArgs.progressMeasure === "done"
        ? "boolean"
        : "number"
      : taskType.valueKind;
    await priorityClassQueries({ ctx }).getById({
      priorityClassId: taskArgs.priorityClassId,
    });
    zodParse(
      taskWithCorrectValuesSchema,
      Object.fromEntries(
        Object.entries({
          ...taskArgs,
          valueKind,
          dueAt: parsedDueAt,
        }).filter(([, value]) => value !== undefined)
      )
    );

    const { tags, ...rawTask } = taskArgs;

    const newTaskId = await ctx.db.insert("tasks", {
      ...rawTask,
      userId: ctx.userId,
      valueKind,
      priorityIndex: generateKeyBetween(
        null,
        await getFirstPriorityIndexInClass(ctx, rawTask.priorityClassId)
      ),
      initialNumValue: rawTask.initialNumValue ?? taskType.initialNumValue,
      currentNumValue: rawTask.initialNumValue ?? taskType.initialNumValue,
      completedNumValue:
        rawTask.completedNumValue ?? taskType.completedNumValue,
      currentEnumOptionId: taskType.initialEnumOptionId,
    });

    for (const tagId of tags) {
      await tagQueries({ ctx }).getById({ tagId });
      await ctx.db.insert("tagTasks", { taskId: newTaskId, tagId });
    }

    await autoPlan(ctx);
    return newTaskId;
  },
});

export const update = authedMutation({
  args: updateTaskConvexSchema,
  rateLimit: { name: "updateTask" },
  handler: async (ctx, { taskId, editScope = "future", ...taskArgs }) => {
    const existing = await taskQueries({ ctx }).getById({ taskId });
    Object.assign(
      taskArgs,
      await volumeProgress(ctx, taskArgs, existing.taskTypeId)
    );
    if (taskArgs.recurrence)
      taskArgs.recurrence = {
        ...taskArgs.recurrence,
        ...(await getRecurrenceCalendar(ctx, taskArgs.recurrence.timezone)),
      };
    if (taskArgs.recurrence) validateRecurrence(taskArgs.recurrence);
    const series = existing.seriesId
      ? await taskQueries({ ctx }).getById({ taskId: existing.seriesId })
      : existing.recurrence
        ? existing
        : undefined;
    const recurrence = taskArgs.recurrence;
    if (existing.seriesId) taskArgs.recurrence = undefined;
    await priorityClassQueries({ ctx }).getById({
      priorityClassId: taskArgs.priorityClassId,
    });
    Object.assign(taskArgs, progressValues(taskArgs));
    if (recurrence?.kind === "volume" && editScope === "future") {
      if (
        taskArgs.progressMeasure !== "time" &&
        taskArgs.progressMeasure !== "quantity"
      )
        throw new ConvexError({
          message: "A volume target needs time or quantity progress",
        });
      taskArgs.completedNumValue = recurrence.volume;
    }
    const parsedDueAt = taskArgs.dueAt ? new Date(taskArgs.dueAt) : undefined;
    zodParse(updateTaskZodSchema, {
      ...taskArgs,
      dueAt: parsedDueAt,
    });
    const { tags, ...rawTask } = taskArgs;

    await tagRelationsUpdate({ ctx }).updateTagsForTask({
      taskId,
      newTags: tags,
    });

    const changes = {
      ...rawTask,
      dueAt: taskArgs.dueAt ?? undefined,
      effortMinutes: taskArgs.effortMinutes,
      minSessionMinutes: taskArgs.minSessionMinutes,
      maxSessionMinutes: taskArgs.maxSessionMinutes,
      automaticSchedulingPaused: taskArgs.automaticSchedulingPaused,
      ...(taskArgs.progressMeasure
        ? {
            valueKind:
              taskArgs.progressMeasure === "done"
                ? ("boolean" as const)
                : ("number" as const),
            ...(taskArgs.progressMeasure !== existing.progressMeasure
              ? {
                  completedAt: undefined,
                  currentNumValue: 0,
                  currentEnumOptionId: undefined,
                }
              : {}),
          }
        : {}),
    };
    await ctx.db.patch(taskId, changes);
    if (existing.seriesId)
      await ctx.db.patch(taskId, {
        occurrenceException: editScope === "occurrence",
        ...(editScope === "future"
          ? { occurrenceCarryForward: recurrence?.carryForward ?? false }
          : {}),
      });
    if (series && editScope === "future") {
      const ruleChanged =
        JSON.stringify(
          series.recurrence,
          Object.keys(series.recurrence ?? {}).sort()
        ) !== JSON.stringify(recurrence, Object.keys(recurrence ?? {}).sort());
      let selectedWindow;
      if (
        ruleChanged &&
        recurrence &&
        recurrence.kind !== "completion" &&
        existing.seriesId
      ) {
        const selectedDate = localDateTime(
          existing.occurrenceStartAt!,
          recurrence.timezone
        ).slice(0, 10);
        const date =
          selectedDate < recurrence.startDate
            ? recurrence.startDate
            : selectedDate;
        const windows = recurrenceWindows(recurrence, date, date);
        selectedWindow =
          windows.find(
            (window) =>
              window.key ===
              existing.occurrenceKey?.split(":").slice(-2).join(":")
          ) ?? windows[0];
        if (selectedWindow)
          await ctx.db.patch(taskId, {
            occurrenceStartAt: selectedWindow.startAt,
            occurrenceTimezone: recurrence.timezone,
            occurrenceEndAt: selectedWindow.endAt,
            occurrenceKey: `${(series.recurrenceRevision ?? 0) + 1}:${selectedWindow.key}`,
          });
      }
      await ctx.db.patch(series._id, {
        ...changes,
        recurrence,
        ...(ruleChanged
          ? {
              recurrenceRevision: (series.recurrenceRevision ?? 0) + 1,
              recurrenceFromAt: Math.max(
                Date.now(),
                selectedWindow?.endAt ??
                  existing.occurrenceEndAt ??
                  existing.occurrenceStartAt ??
                  Date.now()
              ),
            }
          : {}),
        ...(recurrence ? {} : { archivedAt: Date.now() }),
      });
      await tagRelationsUpdate({ ctx }).updateTagsForTask({
        taskId: series._id,
        newTags: tags,
      });
      const occurrences = await ctx.db
        .query("tasks")
        .withIndex("by_series", (q) => q.eq("seriesId", series._id))
        .collect();
      for (const occurrence of occurrences) {
        if (
          occurrence._id === taskId ||
          occurrence.completedAt !== undefined ||
          occurrence.expiredAt !== undefined ||
          occurrence.occurrenceException ||
          occurrence.occurrenceStartAt! <
            Math.max(Date.now(), existing.occurrenceStartAt ?? 0)
        )
          continue;
        if (ruleChanged) {
          await ctx.db.patch(occurrence._id, { archivedAt: Date.now() });
          const sessions = await ctx.db
            .query("sessions")
            .withIndex("by_task", (q) => q.eq("taskId", occurrence._id))
            .collect();
          for (const session of sessions)
            if (
              session.startAt > Date.now() &&
              session.unscheduledAt === undefined
            )
              await ctx.db.patch(session._id, {
                unscheduledAt: Date.now(),
                revision: (session.revision ?? 0) + 1,
              });
        } else {
          await ctx.db.patch(occurrence._id, {
            ...changes,
            recurrence: undefined,
            occurrenceCarryForward: recurrence?.carryForward ?? false,
          });
          await tagRelationsUpdate({ ctx }).updateTagsForTask({
            taskId: occurrence._id,
            newTags: tags,
          });
        }
      }
    }
    await autoPlan(ctx);
  },
});

export const archive = authedMutation({
  args: {
    taskIds: v.array(taskConvexSchema._id),
  },
  rateLimit: { name: "archiveTask" },
  handler: async (ctx, { taskIds }) => {
    await Promise.all(
      taskIds.map((taskId) => taskQueries({ ctx }).getById({ taskId }))
    );
    const now = Date.now();
    const affected = new Set(taskIds);
    for (const taskId of taskIds) {
      const task = await ctx.db.get(taskId);
      if (!task?.recurrence) continue;
      const occurrences = await ctx.db
        .query("tasks")
        .withIndex("by_series", (q) => q.eq("seriesId", taskId))
        .collect();
      for (const occurrence of occurrences)
        if (
          occurrence.completedAt === undefined &&
          occurrence.occurrenceStartAt! >= now
        )
          affected.add(occurrence._id);
    }
    for (const taskId of affected) {
      await ctx.db.patch(taskId, { archivedAt: now });
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_task", (q) => q.eq("taskId", taskId))
        .collect();
      for (const session of sessions) {
        if (session.unscheduledAt === undefined && session.startAt > now)
          await ctx.db.patch(session._id, {
            unscheduledAt: now,
            revision: (session.revision ?? 0) + 1,
          });
      }
    }
    await autoPlan(ctx);
  },
});

async function getExtendedTaskInfo(ctx: AuthedQueryCtx, task: Doc<"tasks">) {
  const taskType = await taskTypeQueries({ ctx }).getById({
    taskTypeId: task.taskTypeId,
  });
  const priorityClass = await priorityClassQueries({ ctx }).getById({
    priorityClassId: task.priorityClassId,
  });
  const tags = await tagQueries({ ctx }).listByTaskId({ taskId: task._id });

  let enumOptions: Doc<"taskTypeEnumOptions">[] | undefined;
  if (taskType.valueKind === "enum") {
    enumOptions = await taskTypeEnumOptionQueries({ ctx }).listByTaskTypeId({
      taskTypeId: task.taskTypeId,
    });
  }
  return {
    ...task,
    ...(task.seriesId
      ? { recurrence: (await ctx.db.get(task.seriesId))?.recurrence }
      : {}),
    taskType,
    priorityClass,
    tags,
    ...(enumOptions ? { enumOptions } : {}),
  };
}

async function getFirstPriorityIndexInClass(
  ctx: AuthedMutationCtx,
  priorityClassId: Id<"priorityClasses">
) {
  return (
    await ctx.db
      .query("tasks")
      .withIndex("by_user_priority", (q) =>
        q.eq("userId", ctx.userId).eq("priorityClassId", priorityClassId)
      )
      .order("asc")
      .first()
  )?.priorityIndex;
}

function progressValues(input: {
  progressMeasure?: "done" | "time" | "percentage" | "quantity";
  completedNumValue?: number;
}) {
  if (!input.progressMeasure) return {};
  if (input.progressMeasure === "done")
    return { initialNumValue: undefined, completedNumValue: undefined };
  const target =
    input.progressMeasure === "percentage" ? 100 : input.completedNumValue;
  if (target === undefined || !Number.isFinite(target) || target <= 0) {
    throw new ConvexError({ message: "Enter a positive progress target" });
  }
  return { initialNumValue: 0, completedNumValue: target };
}

async function volumeProgress(
  ctx: AuthedMutationCtx,
  input: {
    recurrence?: Doc<"tasks">["recurrence"];
    progressMeasure?: Doc<"tasks">["progressMeasure"];
  },
  taskTypeId: Id<"taskTypes">
) {
  if (input.recurrence?.kind !== "volume" || input.progressMeasure) return {};
  const taskType = await taskTypeQueries({ ctx }).getById({ taskTypeId });
  const unit = taskType.unitId ? await ctx.db.get(taskType.unitId) : null;
  if (taskType.valueKind !== "number" || unit?.i18nKey === "units_percent")
    throw new ConvexError({
      message: "A volume target needs a Task type with time or quantity units",
    });
  return {
    progressMeasure:
      unit?.i18nKey === "units_minute"
        ? ("time" as const)
        : ("quantity" as const),
    progressUnit: unit?.symbol || unit?.name,
    initialNumValue: 0,
    completedNumValue: input.recurrence.volume,
  };
}
