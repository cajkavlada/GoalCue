import { defineTable } from "convex/server";
import { v } from "convex/values";

export const mailDbSchema = {
  mailSources: defineTable({
    userId: v.string(),
    account: v.string(),
    labelId: v.string(),
    labelName: v.string(),
    bodies: v.boolean(),
    threadContext: v.boolean(),
    attachments: v.boolean(),
    excluded: v.boolean(),
    aiAllowed: v.boolean(),
    connected: v.boolean(),
    lastSuccessAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),
  mailActions: defineTable({
    userId: v.string(),
    sourceId: v.id("mailSources"),
    threadId: v.string(),
    messageId: v.string(),
    actionKey: v.string(),
    taskId: v.id("tasks"),
    kind: v.union(v.literal("action"), v.literal("reply")),
    excerpt: v.optional(v.string()),
    suggestedReply: v.optional(v.string()),
  })
    .index("by_source_thread", ["sourceId", "threadId"])
    .index("by_task", ["taskId"]),
  mailBatches: defineTable({
    userId: v.string(),
    taskId: v.id("tasks"),
    sourceId: v.optional(v.id("mailSources")),
    messageIds: v.array(v.string()),
    reviewedIds: v.array(v.string()),
    startedAt: v.number(),
    manual: v.boolean(),
  }).index("by_task", ["taskId"]),
};
