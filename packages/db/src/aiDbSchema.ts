import { defineTable } from "convex/server";
import { v } from "convex/values";

export const aiProvider = v.union(
  v.literal("openai"),
  v.literal("anthropic"),
  v.literal("gemini")
);
export const aiRole = v.union(v.literal("chat"), v.literal("background"));

export const aiDbSchema = {
  aiConnections: defineTable({
    userId: v.string(),
    provider: aiProvider,
    encryptedKey: v.optional(v.string()),
    funding: v.union(v.literal("personal"), v.literal("owner")),
    chatModel: v.string(),
    backgroundModel: v.string(),
    monthlyLimit: v.number(),
    warningThreshold: v.number(),
    enabled: v.boolean(),
    revision: v.string(),
    version: v.string(),
    retentionAcceptedAt: v.number(),
    accountCheckedAt: v.number(),
  }).index("by_user", ["userId"]),
  aiUsage: defineTable({
    scope: v.string(),
    month: v.string(),
    role: aiRole,
    spent: v.number(),
    reserved: v.number(),
  }).index("by_scope_month", ["scope", "month"]),
  aiRuns: defineTable({
    userId: v.string(),
    requestId: v.string(),
    role: aiRole,
    provider: aiProvider,
    model: v.string(),
    month: v.string(),
    funding: v.union(v.literal("personal"), v.literal("owner")),
    scopes: v.array(v.string()),
    reserved: v.number(),
    inputRate: v.number(),
    outputRate: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("unknown"),
      v.literal("failed"),
      v.literal("complete")
    ),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    cost: v.optional(v.number()),
  })
    .index("by_user_request", ["userId", "requestId"])
    .index("by_status", ["status"])
    .index("by_started", ["startedAt"])
    .index("by_user_started", ["userId", "startedAt"]),
};
