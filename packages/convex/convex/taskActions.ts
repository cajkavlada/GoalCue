import { ConvexError, v } from "convex/values";

import {
  addTaskActionAdvancedSchema,
  addTaskActionConvexSchema,
  taskActionWithValuesSchema,
  taskConvexSchema,
  zodParse,
} from "@gc/validators";

import { Doc, Id } from "./_generated/dataModel";
import { taskQueries, taskTypeQueries } from "./dbQueries";
import { authedMutation, AuthedMutationCtx } from "./utils/authedFunctions";

export const add = authedMutation({
  args: addTaskActionConvexSchema,
  rateLimit: {
    name: "addTaskAction",
    config: { rate: 60, capacity: 60 },
  },
  handler: async (ctx, input) => {
    const { taskId, ...action } = input;

    await zodParse(addTaskActionAdvancedSchema, input);

    const task = await taskQueries({ ctx }).getById({ taskId });
    const taskType = await taskTypeQueries({ ctx }).getById({
      taskTypeId: task.taskTypeId,
    });

    const checkedNewTaskValues = checkTaskValues({
      valueKind: task.valueKind,
      ...action,
      ...(task.valueKind === "number"
        ? {
            completedNumValue: task.completedNumValue,
            initialNumValue: task.initialNumValue,
          }
        : {}),
      ...(task.valueKind === "enum"
        ? { completedEnumOptionId: taskType.completedEnumOptionId }
        : {}),
    });

    await ctx.db.patch(taskId, checkedNewTaskValues);
    return await ctx.db.insert("taskActions", input);
  },
});

function checkTaskValues(
  data: Pick<Doc<"taskActions">, "boolValue" | "numValue" | "enumOptionId"> &
    Pick<Doc<"tasks">, "valueKind" | "initialNumValue" | "completedNumValue"> &
    Pick<Doc<"taskTypes">, "completedEnumOptionId">
) {
  const parseValuesError = new ConvexError({
    message: `Provide correct value for a task action. Value kind is ${data.valueKind}.`,
  });
  const parsed = taskActionWithValuesSchema.safeParse(data);

  if (parsed.error) {
    throw parseValuesError;
  }
  const values = parsed.data;
  if (values.valueKind === "boolean") {
    return {
      completedAt: values.boolValue ? Date.now() : undefined,
    };
  }
  if (values.valueKind === "number") {
    const completed =
      (values.completedNumValue >= values.initialNumValue &&
        values.numValue >= values.completedNumValue) ||
      (values.completedNumValue <= values.initialNumValue &&
        values.numValue <= values.completedNumValue);
    return {
      completedAt: completed ? Date.now() : undefined,
      currentNumValue: values.numValue,
    };
  }
  if (values.valueKind === "enum") {
    return {
      completedAt:
        values.enumOptionId === values.completedEnumOptionId
          ? Date.now()
          : undefined,
      currentEnumOptionId: values.enumOptionId as Id<"taskTypeEnumOptions">,
    };
  }
  throw parseValuesError;
}

type TaskWithBorderValues = Doc<"tasks"> &
  (
    | {
        valueKind: "enum";
        completedEnumOptionId: Id<"taskTypeEnumOptions">;
        initialEnumOptionId: Id<"taskTypeEnumOptions">;
      }
    | { valueKind: "number" }
    | { valueKind: "boolean" }
  );

async function checkTasksAndGetBorderValues(
  ctx: AuthedMutationCtx,
  taskIds: Id<"tasks">[]
) {
  return await Promise.all(
    taskIds.map(async (taskId) => {
      const task = await taskQueries({ ctx }).getById({ taskId });
      if (task.valueKind === "enum") {
        const taskType = await taskTypeQueries({ ctx }).getById({
          taskTypeId: task.taskTypeId,
        });
        return {
          ...task,
          completedEnumOptionId: taskType.completedEnumOptionId,
          initialEnumOptionId: taskType.initialEnumOptionId,
        };
      }
      return task as TaskWithBorderValues;
    })
  );
}

export const addToCompleted = authedMutation({
  args: { taskIds: v.array(taskConvexSchema._id) },
  rateLimit: {
    name: "addBulkToCompletedTaskAction",
    config: { rate: 60, capacity: 60 },
  },
  handler: async (ctx, { taskIds }) => {
    const extendedTasks = await checkTasksAndGetBorderValues(ctx, taskIds);
    for (const task of extendedTasks) {
      if (task.valueKind === "boolean") {
        await ctx.db.patch(task._id, { completedAt: Date.now() });
        await ctx.db.insert("taskActions", {
          taskId: task._id,
          boolValue: true,
        });
      } else if (task.valueKind === "number") {
        await ctx.db.patch(task._id, {
          completedAt: Date.now(),
          currentNumValue: task.completedNumValue,
        });
        await ctx.db.insert("taskActions", {
          taskId: task._id,
          numValue: task.completedNumValue,
        });
      } else if (task.valueKind === "enum") {
        await ctx.db.patch(task._id, {
          completedAt: Date.now(),
          currentEnumOptionId: task.completedEnumOptionId,
        });
        await ctx.db.insert("taskActions", {
          taskId: task._id,
          enumOptionId: task.completedEnumOptionId,
        });
      }
    }
  },
});

export const addToInitial = authedMutation({
  args: { taskIds: v.array(taskConvexSchema._id) },
  rateLimit: {
    name: "addBulkToInitialTaskAction",
    config: { rate: 60, capacity: 60 },
  },
  handler: async (ctx, { taskIds }) => {
    const extendedTasks = await checkTasksAndGetBorderValues(ctx, taskIds);
    for (const task of extendedTasks) {
      if (task.valueKind === "boolean") {
        await ctx.db.patch(task._id, { completedAt: undefined });
        await ctx.db.insert("taskActions", {
          taskId: task._id,
          boolValue: false,
        });
      } else if (task.valueKind === "number") {
        await ctx.db.patch(task._id, {
          completedAt: undefined,
          currentNumValue: task.initialNumValue,
        });
        await ctx.db.insert("taskActions", {
          taskId: task._id,
          numValue: task.initialNumValue,
        });
      } else if (task.valueKind === "enum") {
        await ctx.db.patch(task._id, {
          completedAt: undefined,
          currentEnumOptionId: task.initialEnumOptionId,
        });
        await ctx.db.insert("taskActions", {
          taskId: task._id,
          enumOptionId: task.initialEnumOptionId,
        });
      }
    }
  },
});
