import { v } from "convex/values";

import { aiProvider, aiRole } from "@gc/db";

import {
  internalMutation,
  internalQuery,
  MutationCtx,
} from "./_generated/server";
import {
  allowance,
  cost,
  inputLimit,
  monthAt,
  outputLimit,
  reviewedModel,
  supportedModels,
  timeout,
  unavailable,
} from "./utils/aiPolicy";
import { authedMutation, authedQuery } from "./utils/authedFunctions";

export const catalog = authedQuery({
  args: {},
  handler: async () =>
    Object.entries(supportedModels).flatMap(([provider, models]) =>
      models.map((model) => {
        try {
          const review = reviewedModel(
            provider as keyof typeof supportedModels,
            model
          );
          return {
            provider,
            model,
            availableForActivation: true,
            inputRate: review.inputRate,
            outputRate: review.outputRate,
            retention: review.retention,
            checkedAt: review.checkedAt,
            expiresAt: review.expiresAt,
          };
        } catch {
          return { provider, model, availableForActivation: false };
        }
      })
    ),
});

export const connection = internalQuery({
  args: { userId: v.string() },
  handler: (ctx, { userId }) =>
    ctx.db
      .query("aiConnections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique(),
});

export const configure = internalMutation({
  args: {
    userId: v.string(),
    provider: aiProvider,
    funding: v.union(v.literal("personal"), v.literal("owner")),
    encryptedKey: v.optional(v.string()),
    chatModel: v.string(),
    backgroundModel: v.string(),
    monthlyLimit: v.number(),
    warningThreshold: v.number(),
    revision: v.string(),
    version: v.string(),
  },
  handler: async (ctx, args) => {
    if (
      !Number.isSafeInteger(args.monthlyLimit) ||
      args.monthlyLimit <= 0 ||
      !Number.isFinite(args.warningThreshold) ||
      args.warningThreshold <= 0 ||
      args.warningThreshold >= 1
    )
      unavailable("Invalid AI allowance or warning threshold");
    allowance(args.userId, args.funding, args.monthlyLimit);
    const chat = reviewedModel(args.provider, args.chatModel);
    const background = reviewedModel(args.provider, args.backgroundModel);
    if (args.revision !== chat.revision + background.revision)
      unavailable("AI review changed; activate again");
    if (args.funding === "personal" && !args.encryptedKey)
      unavailable("A personal key is required");
    const old = await ctx.db
      .query("aiConnections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    const value = {
      ...args,
      enabled: true,
      retentionAcceptedAt: Date.now(),
      accountCheckedAt: Date.now(),
    };
    if (old) await ctx.db.replace(old._id, value);
    else await ctx.db.insert("aiConnections", value);
  },
});

export const disable = authedMutation({
  args: { removeKey: v.boolean() },
  handler: async (ctx, { removeKey }) => {
    const value = await ctx.db
      .query("aiConnections")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .unique();
    if (value)
      await ctx.db.patch(value._id, {
        enabled: false,
        ...(removeKey ? { encryptedKey: undefined } : {}),
      });
  },
});

export const status = authedQuery({
  args: {},
  handler: async (ctx) => {
    const value = await ctx.db
      .query("aiConnections")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .unique();
    if (!value) return { enabled: false, manualPlanningAvailable: true };
    const policy = allowance(ctx.userId, value.funding, value.monthlyLimit);
    const month = monthAt(Date.now());
    const rows = await ctx.db
      .query("aiUsage")
      .withIndex("by_scope_month", (q) =>
        q.eq("scope", policy.scopes[0]!).eq("month", month)
      )
      .collect();
    const roles = ["chat", "background"].map((role) => {
      const usage = rows.find((row) => row.role === role);
      const spent = usage?.spent ?? 0,
        reserved = usage?.reserved ?? 0;
      const limit =
        role === "background" ? Math.floor(policy.limit / 4) : policy.limit;
      return {
        role,
        spent,
        reserved,
        limit,
        warning:
          spent + reserved >= limit
            ? "exhausted"
            : spent + reserved >= limit * value.warningThreshold
              ? "threshold"
              : null,
      };
    });
    const spent = rows.reduce((n, row) => n + row.spent, 0);
    const reserved = rows.reduce((n, row) => n + row.reserved, 0);
    const pools = [];
    for (const scope of policy.scopes.slice(1)) {
      const usage = await ctx.db
        .query("aiUsage")
        .withIndex("by_scope_month", (q) =>
          q.eq("scope", scope).eq("month", month)
        )
        .collect();
      const used = usage.reduce((n, row) => n + row.spent + row.reserved, 0);
      const limit = scope === "owner-global" ? 20_000_000 : 10_000_000;
      pools.push({
        scope,
        remaining: Math.max(0, limit - used),
        warning:
          used >= limit
            ? "exhausted"
            : used >= limit * value.warningThreshold
              ? "threshold"
              : null,
      });
    }
    return {
      enabled: value.enabled,
      provider: value.provider,
      chatModel: value.chatModel,
      backgroundModel: value.backgroundModel,
      funding: value.funding,
      key: value.encryptedKey ? "••••••••" : null,
      month,
      currency: "USD",
      unit: "microdollars",
      spent,
      reserved,
      limit: policy.limit,
      remaining: Math.max(0, policy.limit - spent - reserved),
      roles,
      pools,
      warningThreshold: value.warningThreshold,
      warning:
        spent + reserved >= policy.limit
          ? "exhausted"
          : spent + reserved >= policy.limit * value.warningThreshold
            ? "threshold"
            : null,
      manualPlanningAvailable: true,
      providerBillingAuthoritative: true,
      otherApplicationsExcluded: true,
    };
  },
});

export const reserve = internalMutation({
  args: {
    userId: v.string(),
    role: aiRole,
    requestId: v.string(),
    version: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.requestId || args.requestId.length > 128)
      unavailable("Invalid AI request identity");
    const previous = await ctx.db
      .query("aiRuns")
      .withIndex("by_user_request", (q) =>
        q.eq("userId", args.userId).eq("requestId", args.requestId)
      )
      .unique();
    if (previous)
      unavailable(
        "This AI request was already attempted; retry explicitly with a new request identity"
      );
    const value = await ctx.db
      .query("aiConnections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (!value?.enabled || value.version !== args.version)
      unavailable("Activate the AI connection before use");
    const chat = reviewedModel(value.provider, value.chatModel);
    const background = reviewedModel(value.provider, value.backgroundModel);
    if (value.revision !== chat.revision + background.revision)
      unavailable("AI pricing or retention changed; activate again");
    const model =
      args.role === "chat" ? value.chatModel : value.backgroundModel;
    const review = args.role === "chat" ? chat : background;
    const now = Date.now(),
      month = monthAt(now);
    const recent = await ctx.db
      .query("aiRuns")
      .withIndex("by_started", (q) => q.gte("startedAt", now - timeout))
      .collect();
    if (
      recent.length >= 60 ||
      recent.filter((run) => run.userId === args.userId).length >= 10
    )
      unavailable("AI request rate limit reached");
    const active = recent.filter((run) => run.status === "active");
    if (
      active.length >= 10 ||
      active.some((run) => run.userId === args.userId && run.role === args.role)
    )
      unavailable("AI concurrency limit reached");
    const policy = allowance(args.userId, value.funding, value.monthlyLimit);
    const reserved = cost(
      inputLimit,
      outputLimit,
      review.inputRate,
      review.outputRate
    );
    for (const scope of policy.scopes) {
      const rows = await ctx.db
        .query("aiUsage")
        .withIndex("by_scope_month", (q) =>
          q.eq("scope", scope).eq("month", month)
        )
        .collect();
      const limit =
        scope === "owner-global"
          ? 20_000_000
          : scope === "invitee-pool"
            ? 10_000_000
            : policy.limit;
      if (
        rows.reduce((n, row) => n + row.spent + row.reserved, 0) + reserved >
        limit
      )
        unavailable("AI allowance exhausted");
      const backgroundUsage = rows.find((row) => row.role === "background");
      if (
        args.role === "background" &&
        (backgroundUsage?.spent ?? 0) +
          (backgroundUsage?.reserved ?? 0) +
          reserved >
          Math.floor(limit / 4)
      )
        unavailable("Background AI allowance exhausted");
    }
    for (const scope of policy.scopes)
      await adjustUsage(ctx, scope, month, args.role, reserved, 0);
    return ctx.db.insert("aiRuns", {
      userId: args.userId,
      requestId: args.requestId,
      role: args.role,
      provider: value.provider,
      model,
      month,
      funding: value.funding,
      scopes: policy.scopes,
      reserved,
      inputRate: review.inputRate,
      outputRate: review.outputRate,
      status: "active",
      startedAt: now,
    });
  },
});

export const settle = internalMutation({
  args: {
    runId: v.id("aiRuns"),
    outcome: v.union(
      v.literal("complete"),
      v.literal("failed"),
      v.literal("unknown")
    ),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.status === "complete" || run.status === "failed") return;
    if (args.outcome === "unknown") {
      await ctx.db.patch(run._id, {
        status: "unknown",
        finishedAt: Date.now(),
      });
      return;
    }
    const actual =
      args.outcome === "failed"
        ? 0
        : cost(
            args.inputTokens!,
            args.outputTokens!,
            run.inputRate,
            run.outputRate
          );
    for (const scope of run.scopes)
      await adjustUsage(ctx, scope, run.month, run.role, -run.reserved, actual);
    await ctx.db.patch(run._id, {
      status: args.outcome,
      cost: actual,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      finishedAt: Date.now(),
    });
  },
});

async function adjustUsage(
  ctx: MutationCtx,
  scope: string,
  month: string,
  role: "chat" | "background",
  reserved: number,
  spent: number
) {
  const rows = await ctx.db
    .query("aiUsage")
    .withIndex("by_scope_month", (q) => q.eq("scope", scope).eq("month", month))
    .collect();
  const row = rows.find((row) => row.role === role);
  if (row)
    await ctx.db.patch(row._id, {
      reserved: row.reserved + reserved,
      spent: row.spent + spent,
    });
  else await ctx.db.insert("aiUsage", { scope, month, role, reserved, spent });
}

export const runs = authedQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("aiRuns")
      .withIndex("by_user_started", (q) => q.eq("userId", ctx.userId))
      .order("desc")
      .take(50);
    return rows.map(
      ({
        requestId,
        role,
        provider,
        model,
        status,
        startedAt,
        finishedAt,
        inputTokens,
        outputTokens,
        cost,
        reserved,
      }) => ({
        requestId,
        role,
        provider,
        model,
        status,
        startedAt,
        finishedAt,
        inputTokens,
        outputTokens,
        cost,
        reserved,
      })
    );
  },
});
