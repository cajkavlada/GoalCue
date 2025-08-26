import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError } from "convex/values";

import type { RateLimitArgs, RateLimitConfig } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";
import { AuthedMutationCtx } from "./authedFunctions";

export const rateLimiter = new RateLimiter(components.rateLimiter, {});

export type RateLimitOpts = Omit<Partial<RateLimitArgs>, "name">;

export async function rateLimit({
  ctx,
  name,
  opts,
  config,
}: {
  ctx: AuthedMutationCtx;
  name: string;
  opts?: Omit<RateLimitOpts, "config">;
  config?: Partial<RateLimitConfig>;
}) {
  const { userId } = ctx;

  const result = await rateLimiter.limit(ctx, name, {
    key: userId,
    config: {
      kind: "token bucket",
      rate: 20,
      period: MINUTE,
      capacity: 20,
      ...config,
    } as RateLimitConfig,
    ...opts,
  });

  if (!result.ok) {
    throw new ConvexError({
      message: `Rate limit for action ${name} exceeded`,
    });
  }
}
