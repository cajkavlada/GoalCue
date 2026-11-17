import { ConvexError, v } from "convex/values";
import { generateKeyBetween } from "fractional-indexing";

import { localDateTime } from "@gc/validators";

import { Id } from "./_generated/dataModel";
import {
  priorityClassQueries,
  taskQueries,
  taskTypeQueries,
} from "./dbQueries";
import {
  authedMutation,
  authedQuery,
  AuthedQueryCtx,
} from "./utils/authedFunctions";
import { autoPlan } from "./utils/autoPlan";
import { planningTool } from "./utils/planningTool";
import { getRecurrenceCalendar } from "./utils/recurrence";

async function sourceFor(ctx: AuthedQueryCtx, id: Id<"mailSources">) {
  const source = await ctx.db.get(id);
  if (!source || source.userId !== ctx.userId)
    throw new ConvexError("Mail Source not found");
  return source;
}

async function threadActions(
  ctx: AuthedQueryCtx,
  source: Awaited<ReturnType<typeof sourceFor>>,
  threadId: string
) {
  const sources = await ctx.db
    .query("mailSources")
    .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
    .collect();
  const actions = await Promise.all(
    sources
      .filter((s) => s.account === source.account && s.connected && !s.excluded)
      .map((s) =>
        ctx.db
          .query("mailActions")
          .withIndex("by_source_thread", (q) =>
            q.eq("sourceId", s._id).eq("threadId", threadId)
          )
          .collect()
      )
  );
  return actions.flat();
}

export const list = authedQuery({
  args: {},
  handler: async (ctx) => {
    const sources = await ctx.db
      .query("mailSources")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect();
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user_priority", (q) => q.eq("userId", ctx.userId))
      .collect();
    return {
      sources,
      routines: tasks.filter(
        (t) =>
          t.mailRoutine &&
          !t.recurrence &&
          t.archivedAt === undefined &&
          t.expiredAt === undefined &&
          t.completedAt === undefined
      ),
    };
  },
});

export const refreshed = authedMutation({
  args: { sourceId: v.id("mailSources") },
  handler: async (ctx, { sourceId }) => {
    const source = await sourceFor(ctx, sourceId);
    if (!source.connected || source.excluded)
      throw new ConvexError("Source unavailable");
    await ctx.db.patch(sourceId, { lastSuccessAt: Date.now() });
  },
});

export const saveSource = authedMutation({
  args: {
    sourceId: v.optional(v.id("mailSources")),
    account: v.string(),
    labelId: v.string(),
    labelName: v.string(),
    bodies: v.boolean(),
    threadContext: v.boolean(),
    attachments: v.boolean(),
    excluded: v.boolean(),
    aiAllowed: v.boolean(),
  },
  handler: async (ctx, { sourceId, ...values }) => {
    if (!values.account.trim() || !values.labelId.trim())
      throw new ConvexError("Choose an account and label");
    const sources = await ctx.db
      .query("mailSources")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect();
    const existing = sourceId
      ? await sourceFor(ctx, sourceId)
      : sources.find(
          (s) => s.account === values.account && s.labelId === values.labelId
        );
    if (
      existing &&
      (existing.account !== values.account ||
        existing.labelId !== values.labelId)
    )
      throw new ConvexError("A Source cannot change account or label");
    if (existing && !sourceId) {
      await ctx.db.patch(existing._id, { connected: true });
      return existing._id;
    }
    const id =
      existing?._id ??
      (await ctx.db.insert("mailSources", {
        ...values,
        userId: ctx.userId,
        connected: true,
      }));
    if (
      existing &&
      (values.excluded ||
        (existing.aiAllowed && !values.aiAllowed) ||
        (existing.bodies && !values.bodies) ||
        (existing.threadContext && !values.threadContext) ||
        (existing.attachments && !values.attachments))
    ) {
      const actions = await ctx.db
        .query("mailActions")
        .withIndex("by_source_thread", (q) => q.eq("sourceId", id))
        .collect();
      for (const action of actions)
        await ctx.db.patch(action._id, {
          excerpt: undefined,
          suggestedReply: undefined,
        });
    }
    await ctx.db.patch(id, { ...values, connected: true });
    return id;
  },
});

export const disconnectTool = planningTool({
  args: {
    sourceId: v.id("mailSources"),
    routines: v.union(v.literal("manual"), v.literal("stop")),
  },
  handler: async (ctx, { sourceId, routines }) => {
    await sourceFor(ctx, sourceId);
    await ctx.db.patch(sourceId, { connected: false });
    const actions = await ctx.db
      .query("mailActions")
      .withIndex("by_source_thread", (q) => q.eq("sourceId", sourceId))
      .collect();
    for (const action of actions)
      await ctx.db.patch(action._id, {
        excerpt: undefined,
        suggestedReply: undefined,
      });
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user_priority", (q) => q.eq("userId", ctx.userId))
      .collect();
    for (const task of tasks.filter(
      (t) => t.mailRoutine && t.mailSourceId === sourceId
    )) {
      const stop =
        routines === "stop" &&
        task.completedAt === undefined &&
        (task.recurrence !== undefined ||
          (task.occurrenceStartAt ?? 0) > Date.now());
      await ctx.db.patch(task._id, {
        mailSourceId: undefined,
        ...(stop ? { archivedAt: Date.now() } : {}),
      });
      if (stop) {
        const sessions = await ctx.db
          .query("sessions")
          .withIndex("by_task", (q) => q.eq("taskId", task._id))
          .collect();
        for (const session of sessions)
          if (session.startAt > Date.now())
            await ctx.db.patch(session._id, {
              unscheduledAt: Date.now(),
              revision: (session.revision ?? 0) + 1,
            });
      }
    }
    await autoPlan(ctx);
  },
});

export const actionsForThread = authedQuery({
  args: { sourceId: v.id("mailSources"), threadId: v.string() },
  handler: async (ctx, { sourceId, threadId }) => {
    const source = await sourceFor(ctx, sourceId);
    if (!source.connected || source.excluded) return [];
    const actions = await threadActions(ctx, source, threadId);
    return Promise.all(
      actions.map(async (action) => ({
        ...action,
        task: await ctx.db.get(action.taskId),
      }))
    );
  },
});

export const saveAction = authedMutation({
  args: {
    sourceId: v.id("mailSources"),
    messageId: v.string(),
    threadId: v.string(),
    actionKey: v.string(),
    kind: v.union(v.literal("action"), v.literal("reply")),
    title: v.string(),
    excerpt: v.optional(v.string()),
    suggestedReply: v.optional(v.string()),
    missingInputs: v.array(v.string()),
    taskTypeId: v.id("taskTypes"),
    priorityClassId: v.id("priorityClasses"),
  },
  handler: async (ctx, input) => {
    const source = await sourceFor(ctx, input.sourceId);
    if (!source.connected || source.excluded)
      throw new ConvexError("Mail Source is disconnected or excluded");
    if (
      (!source.bodies &&
        (input.excerpt ||
          input.suggestedReply ||
          input.missingInputs.some((s) => s.trim()))) ||
      (input.excerpt?.length ?? 0) > 2000 ||
      (input.suggestedReply?.length ?? 0) > 5000
    )
      throw new ConvexError(
        "Source permissions or content limits do not permit this excerpt or reply"
      );
    if (
      !input.title.trim() ||
      input.title.length > 500 ||
      !input.messageId ||
      !input.threadId ||
      !input.actionKey
    )
      throw new ConvexError("Enter a title and stable message/action identity");
    await taskTypeQueries({ ctx }).getById({ taskTypeId: input.taskTypeId });
    await priorityClassQueries({ ctx }).getById({
      priorityClassId: input.priorityClassId,
    });
    const actions = await threadActions(ctx, source, input.threadId);
    const existing = actions.find((a) => a.actionKey === input.actionKey);
    if (existing)
      await taskQueries({ ctx }).getById({ taskId: existing.taskId });
    if (existing && existing.sourceId !== source._id) {
      const original = await sourceFor(ctx, existing.sourceId);
      if (
        !original.bodies &&
        (input.excerpt ||
          input.suggestedReply ||
          input.missingInputs.some((s) => s.trim()))
      )
        throw new ConvexError("The original Source excludes message bodies");
    }
    const taskId =
      existing?.taskId ??
      (await ctx.db.insert("tasks", {
        userId: ctx.userId,
        title: input.title.trim(),
        taskTypeId: input.taskTypeId,
        priorityClassId: input.priorityClassId,
        priorityIndex: generateKeyBetween(null, null),
        valueKind: "boolean",
        progressMeasure: "done",
        priority: "normal",
      }));
    const values = {
      userId: ctx.userId,
      sourceId: existing?.sourceId ?? input.sourceId,
      messageId: input.messageId,
      threadId: input.threadId,
      actionKey: input.actionKey,
      taskId,
      kind: input.kind,
      excerpt: input.excerpt,
      suggestedReply:
        input.kind === "reply" && source.bodies
          ? [
              input.suggestedReply,
              ...input.missingInputs
                .filter((s) => s.trim())
                .map((s) => `[INPUT NEEDED: ${s.trim()}]`),
            ]
              .filter(Boolean)
              .join("\n") || undefined
          : undefined,
    };
    if (existing) await ctx.db.patch(existing._id, values);
    else await ctx.db.insert("mailActions", values);
    await autoPlan(ctx);
    return taskId;
  },
});

export const taskDetails = authedQuery({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    await taskQueries({ ctx }).getById({ taskId });
    const action = await ctx.db
      .query("mailActions")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .first();
    if (!action) return null;
    const source = await sourceFor(ctx, action.sourceId);
    return {
      ...action,
      account: source.account,
      available: source.connected && !source.excluded,
    };
  },
});

export const createRoutine = authedMutation({
  args: {
    sourceId: v.optional(v.id("mailSources")),
    kind: v.union(v.literal("inbox"), v.literal("spam")),
    taskTypeId: v.id("taskTypes"),
    priorityClassId: v.id("priorityClasses"),
    timezone: v.string(),
    batchSize: v.number(),
  },
  handler: async (ctx, input) => {
    if (input.sourceId) await sourceFor(ctx, input.sourceId);
    await taskTypeQueries({ ctx }).getById({ taskTypeId: input.taskTypeId });
    await priorityClassQueries({ ctx }).getById({
      priorityClassId: input.priorityClassId,
    });
    if (
      !Number.isInteger(input.batchSize) ||
      input.batchSize < 1 ||
      input.batchSize > 50
    )
      throw new ConvexError("Choose a batch size from 1 to 50");
    const calendar = await getRecurrenceCalendar(ctx, input.timezone);
    const inbox = input.kind === "inbox";
    const id = await ctx.db.insert("tasks", {
      userId: ctx.userId,
      title: inbox ? "Inbox review" : "Spam cleanup",
      taskTypeId: input.taskTypeId,
      priorityClassId: input.priorityClassId,
      priorityIndex: generateKeyBetween(null, null),
      valueKind: "boolean",
      progressMeasure: "done",
      priority: "normal",
      effortMinutes: inbox ? 15 : 10,
      mailRoutine: input.kind,
      mailSourceId: input.sourceId,
      mailBatchSize: input.batchSize,
      recurrence: {
        ...calendar,
        kind: "calendar",
        unit: inbox ? "day" : "week",
        interval: 1,
        startDate: localDateTime(Date.now(), calendar.timezone).slice(0, 10),
        time: "00:00",
        count: 1,
        volume: 1,
        carryForward: false,
        ...(inbox ? { weekdays: [1, 2, 3, 4, 5] } : {}),
      },
    });
    await autoPlan(ctx);
    return id;
  },
});

export const batch = authedQuery({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    await taskQueries({ ctx }).getById({ taskId });
    return ctx.db
      .query("mailBatches")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .first();
  },
});

export const startBatch = authedMutation({
  args: {
    taskId: v.id("tasks"),
    messageIds: v.array(v.string()),
    manual: v.boolean(),
  },
  handler: async (ctx, { taskId, messageIds, manual }) => {
    const task = await taskQueries({ ctx }).getById({ taskId });
    if (
      !task.mailRoutine ||
      task.recurrence ||
      task.completedAt !== undefined ||
      task.expiredAt !== undefined
    )
      throw new ConvexError("Choose an unfinished review Occurrence");
    if (task.mailSourceId) {
      const source = await sourceFor(ctx, task.mailSourceId);
      if (!manual && (!source.connected || source.excluded))
        throw new ConvexError("Source unavailable; review manually");
    } else if (!manual) throw new ConvexError("This is a manual review");
    const existing = await ctx.db
      .query("mailBatches")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .first();
    if (existing) return existing._id;
    if (messageIds.length > (task.mailBatchSize ?? 25))
      throw new ConvexError("Review batch exceeds its configured limit");
    return ctx.db.insert("mailBatches", {
      userId: ctx.userId,
      taskId,
      sourceId: task.mailSourceId,
      messageIds: manual ? [] : [...new Set(messageIds)],
      reviewedIds: [],
      startedAt: Date.now(),
      manual,
    });
  },
});

export const reviewMessage = authedMutation({
  args: { taskId: v.id("tasks"), messageId: v.string() },
  handler: async (ctx, { taskId, messageId }) => {
    await taskQueries({ ctx }).getById({ taskId });
    const batch = await ctx.db
      .query("mailBatches")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .first();
    if (!batch || !batch.messageIds.includes(messageId))
      throw new ConvexError("Message is outside this review batch");
    await ctx.db.patch(batch._id, {
      reviewedIds: [...new Set([...batch.reviewedIds, messageId])],
    });
  },
});

export const disconnect = authedMutation(disconnectTool);
