import { ConvexError, v } from "convex/values";

import { Id } from "./_generated/dataModel";
import {
  authedMutation,
  authedQuery,
  AuthedQueryCtx,
} from "./utils/authedFunctions";
import { autoPlan } from "./utils/autoPlan";

export async function validateMembership(
  ctx: AuthedQueryCtx,
  projectId?: Id<"projects">,
  milestoneId?: Id<"milestones">
) {
  if (projectId) {
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== ctx.userId)
      throw new ConvexError({ message: "Project not found" });
  }
  if (milestoneId) {
    const milestone = await ctx.db.get(milestoneId);
    if (
      !milestone ||
      milestone.userId !== ctx.userId ||
      milestone.projectId !== projectId
    )
      throw new ConvexError({ message: "Choose a Milestone in this Project" });
  }
}

export const list = authedQuery({
  args: {},
  handler: async (ctx) => ({
    projects: await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect(),
    milestones: await ctx.db
      .query("milestones")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect(),
  }),
});

export const saveProject = authedMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    weeklyMinutes: v.number(),
    weekdays: v.array(v.number()),
  },
  rateLimit: { name: "saveProject" },
  handler: async (ctx, { projectId, ...values }) => {
    if (
      !values.title.trim() ||
      !Number.isInteger(values.weeklyMinutes) ||
      values.weeklyMinutes < 0 ||
      values.weeklyMinutes > 10080 ||
      values.weekdays.some(
        (day) => !Number.isInteger(day) || day < 0 || day > 6
      ) ||
      new Set(values.weekdays).size !== values.weekdays.length
    )
      throw new ConvexError({
        message: "Enter a title, weekly minutes (0–10080), and valid weekdays",
      });
    await validateMembership(ctx, projectId);
    const data = { ...values, title: values.title.trim() };
    const id =
      projectId ??
      (await ctx.db.insert("projects", { ...data, userId: ctx.userId }));
    if (projectId) await ctx.db.patch(projectId, data);
    await autoPlan(ctx);
    return id;
  },
});

export const createMilestone = authedMutation({
  args: { projectId: v.id("projects"), title: v.string() },
  rateLimit: { name: "createMilestone" },
  handler: async (ctx, { projectId, title }) => {
    await validateMembership(ctx, projectId);
    if (!title.trim())
      throw new ConvexError({ message: "Enter a Milestone title" });
    return ctx.db.insert("milestones", {
      userId: ctx.userId,
      projectId,
      title: title.trim(),
    });
  },
});
