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
import { planningTool } from "./utils/planningTool";

export const list = authedQuery({
  args: {},
  returns: v.array(tagConvexSchema),
  handler: async (ctx) => {
    return tagQueries({ ctx }).list();
  },
});

export const createTool = planningTool({
  args: createTagConvexSchema.fields,
  rateLimit: { name: "createTag" },
  handler: async (ctx, tagArgs) => {
    const existingTags = await tagQueries({ ctx }).list();
    zodParse(getCreateTagZodSchema({ existingTags }), tagArgs);
    return ctx.db.insert("tags", {
      ...tagArgs,
      userId: ctx.userId,
    });
  },
});

export const updateTool = planningTool({
  args: updateTagConvexSchema.fields,
  rateLimit: { name: "updateTag" },
  handler: async (ctx, { tagId, ...tagArgs }) => {
    await tagQueries({ ctx }).getById({ tagId });
    const existingTags = await tagQueries({ ctx }).list();
    zodParse(
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

export const create = authedMutation(createTool);
export const update = authedMutation(updateTool);
