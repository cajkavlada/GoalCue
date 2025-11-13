import { ConvexError, v } from "convex/values";
import { generateNKeysBetween } from "fractional-indexing";

import {
  createTaskTypeConvexSchema,
  extendedTaskTypeConvexSchema,
  getCreateTaskTypeZodSchema,
  getUpdateTaskTypeZodSchema,
  taskTypeConvexSchema,
  updateTaskTypeConvexSchema,
  zodParse,
} from "@gc/validators";

import { Id } from "./_generated/dataModel";
import { checkUnit } from "./units";
import {
  authedMutation,
  AuthedMutationCtx,
  authedQuery,
  AuthedQueryCtx,
} from "./utils/authedFunctions";

export const getAllForUserId = authedQuery({
  args: {},
  returns: v.array(extendedTaskTypeConvexSchema),
  handler: async ({ db, userId }) => {
    const taskTypes = await db
      .query("taskTypes")
      .withIndex("by_userId", (q) =>
        q.eq("userId", userId).eq("archivedAt", undefined)
      )
      .collect();
    const extendedTaskTypes = await Promise.all(
      taskTypes.map(async (taskType) => {
        if (taskType.valueKind !== "enum") {
          return taskType;
        }
        const taskTypeEnumOptions = await db
          .query("taskTypeEnumOptions")
          .withIndex("by_taskTypeId_orderKey", (q) =>
            q.eq("taskTypeId", taskType._id)
          )
          .filter((q) => q.eq(q.field("archivedAt"), undefined))
          .collect();
        return { ...taskType, taskTypeEnumOptions };
      })
    );
    return extendedTaskTypes;
  },
});

export const create = authedMutation({
  args: createTaskTypeConvexSchema,
  rateLimit: { name: "createTaskType" },
  handler: async (ctx, taskTypeArgs) => {
    const existingTaskTypes = await ctx.db
      .query("taskTypes")
      .withIndex("by_userId", (q) =>
        q.eq("userId", ctx.userId).eq("archivedAt", undefined)
      )
      .collect();
    await zodParse(
      getCreateTaskTypeZodSchema({ existingTaskTypes }),
      taskTypeArgs
    );

    if (taskTypeArgs.unitId) {
      await checkUnit(ctx, taskTypeArgs.unitId);
    }

    const { taskTypeEnumOptions, ...rawTaskType } = taskTypeArgs;
    const newTaskTypeId = await ctx.db.insert("taskTypes", {
      ...rawTaskType,
      userId: ctx.userId,
    });

    if (taskTypeEnumOptions) {
      const orderKeys = generateNKeysBetween(
        null,
        null,
        taskTypeEnumOptions.length
      );

      let initialEnumOptionId: Id<"taskTypeEnumOptions"> | undefined;
      let completedEnumOptionId: Id<"taskTypeEnumOptions"> | undefined;

      for (const [
        index,
        newTaskTypeEnumOption,
      ] of taskTypeEnumOptions.entries()) {
        const newTaskTypeEnumOptionId = await ctx.db.insert(
          "taskTypeEnumOptions",
          {
            taskTypeId: newTaskTypeId,
            name: newTaskTypeEnumOption.name,
            orderKey: orderKeys[index]!,
          }
        );
        if (index === 0) {
          initialEnumOptionId = newTaskTypeEnumOptionId;
        }
        if (index === taskTypeEnumOptions.length - 1) {
          completedEnumOptionId = newTaskTypeEnumOptionId;
        }
      }
      if (initialEnumOptionId && completedEnumOptionId) {
        await ctx.db.patch(newTaskTypeId, {
          initialEnumOptionId,
          completedEnumOptionId,
        });
      }
    }
    return newTaskTypeId;
  },
});

export const update = authedMutation({
  args: updateTaskTypeConvexSchema,
  rateLimit: { name: "updateTaskType" },
  handler: async (ctx, { taskTypeId, ...taskTypeArgs }) => {
    const originalTaskType = await checkTaskType(ctx, taskTypeId);

    const existingTaskTypes = await ctx.db
      .query("taskTypes")
      .withIndex("by_userId", (q) =>
        q.eq("userId", ctx.userId).eq("archivedAt", undefined)
      )
      .collect();
    await zodParse(
      getUpdateTaskTypeZodSchema({
        existingTaskTypes,
        currentTaskTypeId: taskTypeId,
      }),
      {
        ...taskTypeArgs,
        valueKind: originalTaskType.valueKind,
      }
    );
    if (taskTypeArgs.unitId) {
      await checkUnit(ctx, taskTypeArgs.unitId);
    } else {
      taskTypeArgs.unitId = undefined;
    }

    const { taskTypeEnumOptions, archivedTaskTypeEnumOptions, ...rawTaskType } =
      taskTypeArgs;

    const now = Date.now();
    for (const archivedTaskTypeEnumOptionId of archivedTaskTypeEnumOptions ??
      []) {
      await ctx.db.patch(archivedTaskTypeEnumOptionId, { archivedAt: now });
    }

    if (taskTypeEnumOptions) {
      const originalEnumOptions = await ctx.db
        .query("taskTypeEnumOptions")
        .withIndex("by_taskTypeId_orderKey", (q) =>
          q.eq("taskTypeId", taskTypeId)
        )
        .filter((q) => q.eq(q.field("archivedAt"), undefined))
        .collect();

      const orderKeys = generateNKeysBetween(
        null,
        null,
        taskTypeEnumOptions.length
      );

      let initialEnumOptionId: Id<"taskTypeEnumOptions"> | undefined;
      let completedEnumOptionId: Id<"taskTypeEnumOptions"> | undefined;

      for (const [index, taskTypeEnumOption] of (
        taskTypeEnumOptions ?? []
      ).entries()) {
        if (taskTypeEnumOption._id) {
          const originalEnumOption = originalEnumOptions.find(
            (option) => option._id === taskTypeEnumOption._id
          );
          const nameChanged =
            taskTypeEnumOption.name !== originalEnumOption?.name;

          await ctx.db.patch(taskTypeEnumOption._id, {
            name: taskTypeEnumOption.name,
            orderKey: orderKeys[index]!,
            // remove i18n key if name has changed
            i18nKey: nameChanged ? undefined : originalEnumOption?.i18nKey,
          });
          if (index === 0) {
            initialEnumOptionId = taskTypeEnumOption._id;
          }
          if (index === taskTypeEnumOptions.length - 1) {
            completedEnumOptionId = taskTypeEnumOption._id;
          }
        } else {
          const newTaskTypeEnumOptionId = await ctx.db.insert(
            "taskTypeEnumOptions",
            {
              taskTypeId,
              name: taskTypeEnumOption.name,
              orderKey: orderKeys[index]!,
            }
          );
          if (index === 0) {
            initialEnumOptionId = newTaskTypeEnumOptionId;
          }
          if (index === taskTypeEnumOptions.length - 1) {
            completedEnumOptionId = newTaskTypeEnumOptionId;
          }
        }
        if (initialEnumOptionId && completedEnumOptionId) {
          await ctx.db.patch(taskTypeId, {
            initialEnumOptionId,
            completedEnumOptionId,
            ...rawTaskType,
          });
        }
      }
    } else {
      await ctx.db.patch(taskTypeId, rawTaskType);
    }
  },
});

export const archive = authedMutation({
  args: {
    taskTypeIds: v.array(taskTypeConvexSchema.fields._id),
  },
  rateLimit: { name: "archiveTaskType" },
  handler: async (ctx, { taskTypeIds }) => {
    await Promise.all(
      taskTypeIds.map((taskTypeId) => checkTaskType(ctx, taskTypeId))
    );
    const now = Date.now();
    for (const taskTypeId of taskTypeIds) {
      await ctx.db.patch(taskTypeId, { archivedAt: now });
    }
  },
});

async function checkTaskType(
  ctx: AuthedMutationCtx | AuthedQueryCtx,
  taskTypeId: Id<"taskTypes">
) {
  const { db, userId } = ctx;
  const taskType = await db.get(taskTypeId);
  if (!taskType) {
    throw new ConvexError({ message: "Task type not found" });
  }
  if (taskType.userId !== userId) {
    throw new ConvexError({ message: "Not authorized for this task type" });
  }
  return taskType;
}
