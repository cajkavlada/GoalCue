import { v } from "convex/values";

import {
  createTagConvexSchema,
  getCreateTagZodSchema,
  getUpdateTagZodSchema,
  tagConvexSchema,
  updateTagConvexSchema,
  zodParse,
} from "@gc/validators";

import { tagQueries } from "./dbQueries";
import { authedMutation, authedQuery } from "./utils/authedFunctions";

export const list = authedQuery({
  args: {},
  returns: v.array(tagConvexSchema),
  handler: async (ctx) => {
    return tagQueries({ ctx }).list();
  },
});

export const create = authedMutation({
  args: createTagConvexSchema,
  rateLimit: { name: "createTag" },
  handler: async (ctx, tagArgs) => {
    const existingTags = await tagQueries({ ctx }).list();
    await zodParse(getCreateTagZodSchema({ existingTags }), tagArgs);
    return ctx.db.insert("tags", {
      ...tagArgs,
      userId: ctx.userId,
    });
  },
});

export const update = authedMutation({
  args: updateTagConvexSchema,
  rateLimit: { name: "updateTag" },
  handler: async (ctx, { tagId, ...tagArgs }) => {
    await tagQueries({ ctx }).getById({ tagId });
    const existingTags = await tagQueries({ ctx }).list();
    await zodParse(
      getUpdateTagZodSchema({ existingTags, currentTagId: tagId }),
      tagArgs
    );
    return ctx.db.patch(tagId, tagArgs);
  },
});

export const archive = authedMutation({
  args: {
    tagIds: v.array(tagConvexSchema.fields._id),
  },
  rateLimit: { name: "archiveTag" },
  handler: async (ctx, { tagIds }) => {
    await Promise.all(
      tagIds.map((tagId) => tagQueries({ ctx }).getById({ tagId }))
    );
    const now = Date.now();
    for (const tagId of tagIds) {
      await ctx.db.patch(tagId, { archivedAt: now });
    }
  },
});
