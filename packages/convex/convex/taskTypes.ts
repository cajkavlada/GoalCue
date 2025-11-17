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
  taskTypeQueries,
  unitQueries,
} from "./dbQueries";
import { authedMutation, authedQuery } from "./utils/authedFunctions";

export const getAllForUserId = authedQuery({
  args: {},
  returns: v.array(extendedTaskTypeConvexSchema),
  handler: async (ctx) => {
    const taskTypes = await taskTypeQueries({ ctx }).getAll();
    const extendedTaskTypes = await Promise.all(
      taskTypes.map(async (taskType) => {
        const tags = await tagQueries({ ctx }).getAllForTaskType({
          taskTypeId: taskType._id,
        });

        let taskTypeEnumOptions: Doc<"taskTypeEnumOptions">[] | undefined;
        if (taskType.valueKind === "enum") {
          taskTypeEnumOptions = await taskTypeEnumOptionQueries({
            ctx,
          }).getAllForTaskType({ taskTypeId: taskType._id });
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
  handler: async (ctx, taskTypeArgs) => {
    const existingTaskTypes = await taskTypeQueries({ ctx }).getAll();
    await zodParse(
      getCreateTaskTypeZodSchema({ existingTaskTypes }),
      taskTypeArgs
    );

    if (taskTypeArgs.unitId) {
      await unitQueries({ ctx }).getOne({ unitId: taskTypeArgs.unitId });
    }

    const { taskTypeEnumOptions, tags, ...rawTaskType } = taskTypeArgs;

    const newTaskTypeId = await ctx.db.insert("taskTypes", {
      ...rawTaskType,
      userId: ctx.userId,
    });

    for (const tagId of tags) {
      await tagQueries({ ctx }).getOne({ tagId });
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
    const originalTaskType = await taskTypeQueries({ ctx }).getOne({
      taskTypeId,
    });

    const existingTaskTypes = await taskTypeQueries({ ctx }).getAll();
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
      await unitQueries({ ctx }).getOne({ unitId: taskTypeArgs.unitId });
    } else {
      taskTypeArgs.unitId = undefined;
    }

    const {
      taskTypeEnumOptions,
      archivedTaskTypeEnumOptions,
      tags,
      ...rawTaskType
    } = taskTypeArgs;

    await tagRelationsUpdate({ ctx }).updateTagsForTaskType({
      taskTypeId,
      newTags: tags,
    });

    const now = Date.now();
    for (const archivedTaskTypeEnumOptionId of archivedTaskTypeEnumOptions ??
      []) {
      await ctx.db.patch(archivedTaskTypeEnumOptionId, { archivedAt: now });
    }

    if (taskTypeEnumOptions) {
      const originalEnumOptions = await taskTypeEnumOptionQueries({
        ctx,
      }).getAllForTaskType({ taskTypeId });

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
      taskTypeIds.map((taskTypeId) =>
        taskTypeQueries({ ctx }).getOne({ taskTypeId })
      )
    );
    const now = Date.now();
    for (const taskTypeId of taskTypeIds) {
      await ctx.db.patch(taskTypeId, { archivedAt: now });
    }
  },
});
