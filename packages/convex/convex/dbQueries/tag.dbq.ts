import { ConvexError } from "convex/values";

import { Id } from "../_generated/dataModel";
import { AuthedMutationCtx, AuthedQueryCtx } from "../utils/authedFunctions";
import { getIdsToAddAndRemoveforUpdate } from "../utils/relationsUtils";

export function tagQueries({ ctx }: { ctx: AuthedQueryCtx }) {
  return {
    getAll() {
      return ctx.db
        .query("tags")
        .withIndex("by_userId_name", (q) =>
          q.eq("userId", ctx.userId).eq("archivedAt", undefined)
        )
        .collect();
    },

    async getAllForTask({ taskId }: { taskId: Id<"tasks"> }) {
      const tagTasks = await this.getAllRelationsForTask({ taskId });
      return await Promise.all(
        tagTasks.map((tagTask) => this.getOne({ tagId: tagTask.tagId }))
      );
    },

    async getAllForTaskType({ taskTypeId }: { taskTypeId: Id<"taskTypes"> }) {
      const tagTaskTypes = await this.getAllRelationsForTaskType({
        taskTypeId,
      });

      return await Promise.all(
        tagTaskTypes.map((tagTaskType) =>
          this.getOne({ tagId: tagTaskType.tagId })
        )
      );
    },

    getAllRelationsForTask({ taskId }: { taskId: Id<"tasks"> }) {
      return ctx.db
        .query("tagTasks")
        .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
        .collect();
    },

    getAllRelationsForTaskType({
      taskTypeId,
    }: {
      taskTypeId: Id<"taskTypes">;
    }) {
      return ctx.db
        .query("tagTaskTypes")
        .withIndex("by_taskTypeId", (q) => q.eq("taskTypeId", taskTypeId))
        .collect();
    },

    async getOne({ tagId }: { tagId: Id<"tags"> }) {
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
      }).getAllRelationsForTaskType({ taskTypeId });
      const { idsToAdd: tagsToAdd, idsToRemove: tagsToRemove } =
        getIdsToAddAndRemoveforUpdate({
          originalIds: originalTagRelations.map((rel) => rel.tagId),
          newIds: newTags,
        });
      for (const tagId of tagsToAdd) {
        await tagQueries({ ctx }).getOne({ tagId });
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
      }).getAllRelationsForTask({ taskId });
      const { idsToAdd: tagsToAdd, idsToRemove: tagsToRemove } =
        getIdsToAddAndRemoveforUpdate({
          originalIds: originalTagRelations.map((rel) => rel.tagId),
          newIds: newTags,
        });
      for (const tagId of tagsToAdd) {
        await tagQueries({ ctx }).getOne({ tagId });
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
