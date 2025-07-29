import {
  customAction,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";

import { action, mutation, query } from "../_generated/server";

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
