import {
  customAction,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { ConvexError } from "convex/values";

import {
  action,
  ActionCtx,
  mutation,
  MutationCtx,
  query,
  QueryCtx,
} from "../_generated/server";
import { rateLimit as rateLimitFn, RateLimitOpts } from "./rateLimiter";

export const authedQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError({ message: "Not authenticated" });
    }
    return {
      ctx: { userId: identity.subject },
      args: {},
    };
  },
});

export type AuthedQueryCtx = QueryCtx & {
  userId: string;
};

export const authedMutation = customMutation(mutation, {
  args: {},
  input: async (
    ctx,
    _args,
    { rateLimit }: { rateLimit?: { name: string; opts?: RateLimitOpts } }
  ) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError({ message: "Not authenticated" });
    }
    if (rateLimit) {
      const ctxWithUserId = { ...ctx, userId: identity.subject };
      await rateLimitFn(ctxWithUserId, rateLimit.name, rateLimit.opts);
    }
    return {
      ctx: { userId: identity.subject },
      args: {},
    };
  },
});

export type AuthedMutationCtx = MutationCtx & {
  userId: string;
};

export const authedAction = customAction(action, {
  args: {},
  input: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError({ message: "Not authenticated" });
    }
    return {
      ctx: { userId: identity.subject },
      args: {},
    };
  },
});

export type AuthedActionCtx = ActionCtx & {
  userId: string;
};
