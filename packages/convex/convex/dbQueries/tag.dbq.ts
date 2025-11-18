import { ConvexError } from "convex/values";

import { Id } from "../_generated/dataModel";
import { AuthedMutationCtx, AuthedQueryCtx } from "../utils/authedFunctions";
import { getIdsToAddAndRemoveforUpdate } from "../utils/relationsUtils";

export function tagQueries({ ctx }: { ctx: AuthedQueryCtx }) {
  return {
    list() {
      return ctx.db
        .query("tags")
        .withIndex("by_userId_name", (q) =>
          q.eq("userId", ctx.userId).eq("archivedAt", undefined)
        )
        .collect();
    },

    async listByTaskId({ taskId }: { taskId: Id<"tasks"> }) {
      const tagTasks = await this.listRelationsForTask({ taskId });
      return await Promise.all(
        tagTasks.map((tagTask) => this.getById({ tagId: tagTask.tagId }))
      );
    },

    async listByTaskTypeId({ taskTypeId }: { taskTypeId: Id<"taskTypes"> }) {
      const tagTaskTypes = await this.listRelationsForTaskType({
        taskTypeId,
      });

      return await Promise.all(
        tagTaskTypes.map((tagTaskType) =>
          this.getById({ tagId: tagTaskType.tagId })
        )
      );
    },

    listRelationsForTask({ taskId }: { taskId: Id<"tasks"> }) {
      return ctx.db
        .query("tagTasks")
        .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
        .collect();
    },

    listRelationsForTaskType({ taskTypeId }: { taskTypeId: Id<"taskTypes"> }) {
      return ctx.db
        .query("tagTaskTypes")
        .withIndex("by_taskTypeId", (q) => q.eq("taskTypeId", taskTypeId))
        .collect();
    },

    async getById({ tagId }: { tagId: Id<"tags"> }) {
      const tag = await ctx.db.get(tagId);
      if (!tag) {
        throw new ConvexError({ message: "Tag not found" });
      }
      if (tag.userId !== ctx.userId) {
        throw new ConvexError({ message: "Not authorized for this tag" });
      }
      return tag;
    },
  };
}

export function tagRelationsUpdate({ ctx }: { ctx: AuthedMutationCtx }) {
  return {
    async updateTagsForTaskType({
      taskTypeId,
      newTags,
    }: {
      taskTypeId: Id<"taskTypes">;
      newTags: Id<"tags">[];
    }) {
      const originalTagRelations = await tagQueries({
        ctx,
      }).listRelationsForTaskType({ taskTypeId });
      const { idsToAdd: tagsToAdd, idsToRemove: tagsToRemove } =
        getIdsToAddAndRemoveforUpdate({
          originalIds: originalTagRelations.map((rel) => rel.tagId),
          newIds: newTags,
        });
      for (const tagId of tagsToAdd) {
        await tagQueries({ ctx }).getById({ tagId });
        await ctx.db.insert("tagTaskTypes", { taskTypeId, tagId });
      }
      for (const tagId of tagsToRemove) {
        const rel = originalTagRelations.find((rel) => rel.tagId === tagId);
        if (rel) {
          await ctx.db.delete(rel._id);
        }
      }
    },

    async updateTagsForTask({
      taskId,
      newTags,
    }: {
      taskId: Id<"tasks">;
      newTags: Id<"tags">[];
    }) {
      const originalTagRelations = await tagQueries({
        ctx,
      }).listRelationsForTask({ taskId });
      const { idsToAdd: tagsToAdd, idsToRemove: tagsToRemove } =
        getIdsToAddAndRemoveforUpdate({
          originalIds: originalTagRelations.map((rel) => rel.tagId),
          newIds: newTags,
        });
      for (const tagId of tagsToAdd) {
        await tagQueries({ ctx }).getById({ tagId });
        await ctx.db.insert("tagTasks", { taskId, tagId });
      }
      for (const tagId of tagsToRemove) {
        const rel = originalTagRelations.find((rel) => rel.tagId === tagId);
        if (rel) {
          await ctx.db.delete(rel._id);
        }
      }
    },
  };
}
