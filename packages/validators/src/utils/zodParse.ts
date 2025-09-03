import { ConvexError } from "convex/values";
import z from "zod";

export function zodParse<T>(schema: z.ZodSchema<T>, data: unknown) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ConvexError({
      code: "zod_error",
      message: z.prettifyError(result.error),
    });
  }
  return result.data;
}
