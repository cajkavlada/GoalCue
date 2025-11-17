import { generateNKeysBetween } from "fractional-indexing";

import { Id } from "../_generated/dataModel";
import { AuthedMutationCtx, AuthedQueryCtx } from "../utils/authedFunctions";
import { getIdsToAddAndRemoveforUpdate } from "../utils/relationsUtils";

export function taskTypeEnumOptionQueries({ ctx }: { ctx: AuthedQueryCtx }) {
  return {
    getAllForTaskType({ taskTypeId }: { taskTypeId: Id<"taskTypes"> }) {
      return ctx.db
        .query("taskTypeEnumOptions")
        .withIndex("by_taskTypeId_orderKey", (q) =>
          q.eq("taskTypeId", taskTypeId)
        )
        .filter((q) => q.eq(q.field("archivedAt"), undefined))
        .collect();
    },
  };
}

export function taskTypeEnumOptionsUpdate({ ctx }: { ctx: AuthedMutationCtx }) {
  return {
    async updateTagsForTaskType({
      taskTypeId,
      newEnumOptions,
    }: {
      taskTypeId: Id<"taskTypes">;
      newEnumOptions: {
        name: string;
        _id?: Id<"taskTypeEnumOptions">;
      }[];
    }) {
      let initialEnumOptionId: Id<"taskTypeEnumOptions"> | undefined;
      let completedEnumOptionId: Id<"taskTypeEnumOptions"> | undefined;

      const originalEnumOptions = await taskTypeEnumOptionQueries({
        ctx,
      }).getAllForTaskType({ taskTypeId });

      const { idsToRemove: enumOptionsToArchive } =
        getIdsToAddAndRemoveforUpdate({
          originalIds: originalEnumOptions.map((enumOption) => enumOption._id),
          newIds: newEnumOptions
            .filter((enumOption) => enumOption._id)
            .map((enumOption) => enumOption._id as Id<"taskTypeEnumOptions">),
        });
      const now = Date.now();
      for (const taskTypeEnumOptionIdToArchive of enumOptionsToArchive) {
        await ctx.db.patch(taskTypeEnumOptionIdToArchive, {
          archivedAt: now,
        });
      }

      const orderKeys = generateNKeysBetween(null, null, newEnumOptions.length);

      for (const [index, taskTypeEnumOption] of (
        newEnumOptions ?? []
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
          if (index === newEnumOptions.length - 1) {
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
          if (index === newEnumOptions.length - 1) {
            completedEnumOptionId = newTaskTypeEnumOptionId;
          }
        }
      }
      return {
        initEnumOptionId: initialEnumOptionId,
        complEnumOptionId: completedEnumOptionId,
      };
    },
  };
}
