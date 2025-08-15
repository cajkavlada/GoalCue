import {
  customAction,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";

import {
  action,
  ActionCtx,
  mutation,
  MutationCtx,
  query,
  QueryCtx,
} from "../_generated/server";

export const authedQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated in middleware");
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
  input: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated in middleware");
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
      throw new Error("Not authenticated in middleware");
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
