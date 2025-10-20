import { pick } from "convex-helpers";
import { Infer, v } from "convex/values";
import z from "zod";

import { CUSTOM_ERROR_REASONS } from "../utils/customErrorReasons";
import { convexSchemaFromTable } from "../utils/dbSchemaHelpers";
import { taskTypeEnumOptionConvexSchema } from "./taskTypeEnumOptionVal";

export const taskTypeConvexSchema = convexSchemaFromTable("taskTypes");

export type TaskType = Infer<typeof taskTypeConvexSchema>;

// create task type convex schema
export const createTaskTypeConvexSchema = v.object({
  ...pick(taskTypeConvexSchema.fields, [
    "name",
    "valueKind",
    "initialNumValue",
    "completedNumValue",
  ]),
  taskTypeEnumOptions: v.optional(
    v.array(taskTypeEnumOptionConvexSchema.fields.name)
  ),
});

// TODO: infer from convex schema when convexToZod supports zod v4
export const createTaskTypeZodSchema = z.union([
  z.object({
    name: z.string().min(1),
    valueKind: z.literal("boolean"),
  }),
  z
    .object({
      name: z.string().min(1),
      valueKind: z.literal("number"),
      initialNumValue: z.number(),
      completedNumValue: z.number(),
    })
    .superRefine(checkEqualInitialAndCompletedNumValues),
  z.object({
    name: z.string().min(1),
    valueKind: z.literal("enum"),
    taskTypeEnumOptions: z.array(z.string()).min(2),
  }),
]);

// TODO: use this in update task type form validation?
// .superRefine(
//   ({ initialEnumOptionId, completedEnumOptionId, enumOptions }, ctx) => {
//     if (initialEnumOptionId === completedEnumOptionId) {
//       ctx.addIssue({
//         code: "custom",
//         path: ["enumOptions"],
//         params: {
//           reason:
//             CUSTOM_ERROR_REASONS.EQUAL_INITIAL_AND_COMPLETED_ENUM_OPTIONS,
//         },
//       });
//     }
//     if (!enumOptions.includes(initialEnumOptionId)) {
//       ctx.addIssue({
//         code: "custom",
//         path: ["enumOptions"],
//         params: {
//           reason: CUSTOM_ERROR_REASONS.INITIAL_ENUM_OPTION_NOT_FOUND,
//         },
//       });
//     }
//     if (!enumOptions.includes(completedEnumOptionId)) {
//       ctx.addIssue({
//         code: "custom",
//         path: ["enumOptions"],
//         params: {
//           reason: CUSTOM_ERROR_REASONS.COMPLETED_ENUM_OPTION_NOT_FOUND,
//         },
//       });
//     }
//   }
// ),

export type CreateTaskTypeArgs = z.infer<typeof createTaskTypeZodSchema>;

export function checkEqualInitialAndCompletedNumValues(
  {
    initialNumValue,
    completedNumValue,
  }: {
    initialNumValue?: TaskType["initialNumValue"];
    completedNumValue?: TaskType["completedNumValue"];
  },
  ctx: z.RefinementCtx
) {
  if (
    initialNumValue !== undefined &&
    completedNumValue !== undefined &&
    initialNumValue === completedNumValue
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["numValues"],
      params: {
        reason: CUSTOM_ERROR_REASONS.EQUAL_INITIAL_AND_COMPLETED_NUM_VALUES,
      },
    });
  }
}
