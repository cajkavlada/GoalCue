import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";

import type { RateLimitArgs } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";
import { AuthedMutationCtx } from "./authedFunctions";

export const rateLimiter = new RateLimiter(components.rateLimiter, {});

type RateLimitOpts = Omit<Partial<RateLimitArgs>, "name">;

export async function rateLimit(
  ctx: AuthedMutationCtx,
  name: string,
  opts: RateLimitOpts = {}
) {
  const { userId } = ctx;
  const { config = {}, ...rest } = opts;

  await rateLimiter.limit(ctx, name, {
    key: userId,
    config: {
      kind: "token bucket",
      rate: 20,
      period: MINUTE,
      capacity: 20,
      ...config,
    },
    throws: true,
    ...rest,
  });
}
