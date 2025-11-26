import { v } from "convex/values";
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

import { Doc, Id } from "./_generated/dataModel";
import {
  tagQueries,
  tagRelationsUpdate,
  taskTypeEnumOptionQueries,
  taskTypeEnumOptionsUpdate,
  taskTypeQueries,
  unitQueries,
} from "./dbQueries";
import { authedMutation, authedQuery } from "./utils/authedFunctions";

export const listExtended = authedQuery({
  args: {},
  returns: v.array(extendedTaskTypeConvexSchema),
  handler: async (ctx) => {
    const taskTypes = await taskTypeQueries({ ctx }).list();
    const extendedTaskTypes = await Promise.all(
      taskTypes.map(async (taskType) => {
        const tags = await tagQueries({ ctx }).listByTaskTypeId({
          taskTypeId: taskType._id,
        });

        let taskTypeEnumOptions: Doc<"taskTypeEnumOptions">[] | undefined;
        if (taskType.valueKind === "enum") {
          taskTypeEnumOptions = await taskTypeEnumOptionQueries({
            ctx,
          }).listByTaskTypeId({ taskTypeId: taskType._id });
        }

        return {
          ...taskType,
          tags,
          ...(taskTypeEnumOptions ? { taskTypeEnumOptions } : {}),
        };
      })
    );
    return extendedTaskTypes;
  },
});

export const create = authedMutation({
  args: createTaskTypeConvexSchema,
  rateLimit: { name: "createTaskType" },
  handler: async (ctx, taskTypeExtended) => {
    const existingTaskTypes = await taskTypeQueries({ ctx }).list();
    zodParse(
      getCreateTaskTypeZodSchema({ existingTaskTypes }),
      taskTypeExtended
    );

    if (taskTypeExtended.unitId) {
      await unitQueries({ ctx }).getById({ unitId: taskTypeExtended.unitId });
    }

    const { taskTypeEnumOptions, tags, ...taskTypeBase } = taskTypeExtended;

    const newTaskTypeId = await ctx.db.insert("taskTypes", {
      ...taskTypeBase,
      userId: ctx.userId,
    });

    for (const tagId of tags) {
      await tagQueries({ ctx }).getById({ tagId });
      await ctx.db.insert("tagTaskTypes", {
        taskTypeId: newTaskTypeId,
        tagId,
      });
    }

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
    const originalTaskType = await taskTypeQueries({ ctx }).getById({
      taskTypeId,
    });

    const existingTaskTypes = await taskTypeQueries({ ctx }).list();
    zodParse(
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
      await unitQueries({ ctx }).getById({ unitId: taskTypeArgs.unitId });
    } else {
      taskTypeArgs.unitId = undefined;
    }

    const { taskTypeEnumOptions, tags, ...rawTaskType } = taskTypeArgs;

    await tagRelationsUpdate({ ctx }).updateTagsForTaskType({
      taskTypeId,
      newTags: tags,
    });

    let initialEnumOptionId: Id<"taskTypeEnumOptions"> | undefined;
    let completedEnumOptionId: Id<"taskTypeEnumOptions"> | undefined;

    if (taskTypeEnumOptions) {
      const { initEnumOptionId, complEnumOptionId } =
        await taskTypeEnumOptionsUpdate({ ctx }).updateTagsForTaskType({
          taskTypeId,
          newEnumOptions: taskTypeEnumOptions,
        });
      initialEnumOptionId = initEnumOptionId;
      completedEnumOptionId = complEnumOptionId;
    }
    await ctx.db.patch(taskTypeId, {
      ...rawTaskType,
      ...(initialEnumOptionId ? { initialEnumOptionId } : {}),
      ...(completedEnumOptionId ? { completedEnumOptionId } : {}),
    });
  },
});

export const archive = authedMutation({
  args: {
    taskTypeIds: v.array(taskTypeConvexSchema.fields._id),
  },
  rateLimit: { name: "archiveTaskType" },
  handler: async (ctx, { taskTypeIds }) => {
    await Promise.all(
      taskTypeIds.map((taskTypeId) =>
        taskTypeQueries({ ctx }).getById({ taskTypeId })
      )
    );
    const now = Date.now();
    for (const taskTypeId of taskTypeIds) {
      await ctx.db.patch(taskTypeId, { archivedAt: now });
    }
  },
});
