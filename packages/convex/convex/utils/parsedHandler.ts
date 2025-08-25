import { ConvexError } from "convex/values";
import { z } from "zod";

export function parsedHandler<S extends z.ZodTypeAny, Ctx, R>(
  schema: S,
  handler: (ctx: Ctx, input: z.output<S>) => Promise<R> | R
) {
  return (ctx: Ctx, raw: unknown) => {
    const result = schema.safeParse(raw);
    if (!result.success) {
      throw new ConvexError({ message: result.error.message });
    }
    return handler(ctx, result.data);
  };
}
