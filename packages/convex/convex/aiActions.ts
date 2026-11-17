"use node";

import { randomUUID } from "node:crypto";
import { v } from "convex/values";

import { aiProvider, aiRole } from "@gc/db";

import { internal } from "./_generated/api";
import { allowance, cost, reviewedModel, unavailable } from "./utils/aiPolicy";
import {
  callProvider,
  checkAvailability,
  decryptKey,
  encryptKey,
  ownerKey,
  rejectedWithoutCharge,
  validatePrompt,
} from "./utils/aiProviders";
import { authedAction } from "./utils/authedFunctions";

export const activate = authedAction({
  args: {
    provider: aiProvider,
    funding: v.union(v.literal("personal"), v.literal("owner")),
    key: v.optional(v.string()),
    chatModel: v.string(),
    backgroundModel: v.string(),
    monthlyLimit: v.optional(v.number()),
    warningThreshold: v.optional(v.number()),
    retentionAccepted: v.boolean(),
    accountSettingsChecked: v.boolean(),
  },
  handler: async (ctx, args): Promise<{ enabled: boolean }> => {
    if (!args.retentionAccepted || !args.accountSettingsChecked)
      unavailable(
        "Review provider retention, billing and account settings before activation"
      );
    const monthlyLimit = args.monthlyLimit ?? 10_000_000;
    allowance(ctx.userId, args.funding, monthlyLimit);
    const chat = reviewedModel(args.provider, args.chatModel);
    const background = reviewedModel(args.provider, args.backgroundModel);
    const previous = await ctx.runQuery(internal.ai.connection, {
      userId: ctx.userId,
    });
    let encryptedKey: string | undefined;
    let key: string;
    if (args.funding === "personal") {
      if (args.key !== undefined) {
        if (!args.key.trim() || args.key.length > 512)
          unavailable("Invalid personal AI key");
        key = args.key.trim();
        encryptedKey = encryptKey(key, ctx.userId, args.provider);
      } else {
        if (!previous?.encryptedKey || previous.provider !== args.provider)
          unavailable("Enter a key for this provider");
        encryptedKey = previous.encryptedKey;
        key = decryptKey(encryptedKey, ctx.userId, args.provider);
      }
    } else key = ownerKey(args.provider);
    await checkAvailability(args.provider, args.chatModel, key);
    if (args.backgroundModel !== args.chatModel)
      await checkAvailability(args.provider, args.backgroundModel, key);
    await ctx.runMutation(internal.ai.configure, {
      userId: ctx.userId,
      provider: args.provider,
      funding: args.funding,
      encryptedKey,
      chatModel: args.chatModel,
      backgroundModel: args.backgroundModel,
      monthlyLimit,
      warningThreshold: args.warningThreshold ?? 0.8,
      revision: chat.revision + background.revision,
      version: randomUUID(),
    });
    return { enabled: true };
  },
});

export const generate = authedAction({
  args: { role: aiRole, requestId: v.string(), prompt: v.string() },
  handler: async (
    ctx,
    args
  ): Promise<{ text: string; provider: string; model: string }> => {
    validatePrompt(args.prompt);
    const connection = await ctx.runQuery(internal.ai.connection, {
      userId: ctx.userId,
    });
    if (!connection?.enabled)
      unavailable("AI is disabled; manual planning remains available");
    const key =
      connection.funding === "personal"
        ? decryptKey(connection.encryptedKey!, ctx.userId, connection.provider)
        : ownerKey(connection.provider);
    const model =
      args.role === "chat" ? connection.chatModel : connection.backgroundModel;
    const review = reviewedModel(connection.provider, model);
    const runId = await ctx.runMutation(internal.ai.reserve, {
      userId: ctx.userId,
      role: args.role,
      requestId: args.requestId,
      version: connection.version,
    });
    let result;
    try {
      result = await callProvider(connection.provider, model, key, args.prompt);
    } catch (error) {
      await ctx.runMutation(internal.ai.settle, {
        runId,
        outcome: rejectedWithoutCharge(error) ? "failed" : "unknown",
      });
      unavailable(
        "AI request failed; no planning changes were applied. Retry explicitly. Uncertain charges remain reserved"
      );
    }
    try {
      cost(
        result.inputTokens,
        result.outputTokens,
        review.inputRate,
        review.outputRate
      );
    } catch {
      await ctx.runMutation(internal.ai.settle, { runId, outcome: "unknown" });
      unavailable(
        "Provider usage is unavailable; estimated cost remains reserved"
      );
    }
    await ctx.runMutation(internal.ai.settle, {
      runId,
      outcome: "complete",
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
    return { text: result.text, provider: connection.provider, model };
  },
});
