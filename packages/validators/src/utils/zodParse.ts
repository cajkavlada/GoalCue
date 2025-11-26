import { ConvexError } from "convex/values";
import z from "zod";

export function zodParse<T>(schema: z.ZodSchema<T>, data: unknown) {
  const result = schema.safeParse(data);
  if (!result.success) {
    if (result.error.issues[0]?.code === "custom") {
      throw new ConvexError({
        code: "zod_custom_error",
        message: result.error.issues[0]?.params?.reason,
      });
    }
    throw new ConvexError({
      code: "zod_error",
      message: z.prettifyError(result.error),
    });
  }
  return result.data;
}
