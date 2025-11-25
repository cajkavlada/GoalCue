import { pick } from "convex-helpers";
import { convexToZod } from "convex-helpers/server/zod4";
import { partial } from "convex-helpers/validators";
import { Infer, v } from "convex/values";
import z from "zod";

import { CUSTOM_ERROR_REASONS } from "../utils/customErrorReasons";
import { convexSchemaFromTable } from "../utils/dbSchemaHelpers";
import { uniqueField } from "../utils/zodHelpers";
import { tagConvexSchema } from "./tag.val";
import { taskTypeEnumOptionConvexSchema } from "./taskTypeEnumOption.val";

export const taskTypeConvexSchema = convexSchemaFromTable("taskTypes");

export type TaskType = Infer<typeof taskTypeConvexSchema>;

export const extendedTaskTypeConvexSchema = v.object({
  ...taskTypeConvexSchema.fields,
  taskTypeEnumOptions: v.optional(v.array(taskTypeEnumOptionConvexSchema)),
  tags: v.array(tagConvexSchema),
});

export type ExtendedTaskType = Infer<typeof extendedTaskTypeConvexSchema>;

// create task type convex schema
export const createTaskTypeConvexSchema = v.object({
  ...pick(taskTypeConvexSchema.fields, [
    "name",
    "valueKind",
    "initialNumValue",
    "completedNumValue",
    "unitId",
  ]),
  taskTypeEnumOptions: v.optional(
    v.array(
      v.object({
        ...pick(taskTypeEnumOptionConvexSchema.fields, ["name"]),
      })
    )
  ),
  tags: v.array(v.id("tags")),
});

// TODO: infer from convex schema when convexToZod supports zod v4
export function getCreateTaskTypeZodSchema({
  existingTaskTypes,
}: {
  existingTaskTypes: TaskType[];
}) {
  const argsSchema = convexToZod(createTaskTypeConvexSchema);
  const baseSchema = z
    .object({
      ...argsSchema.pick({ tags: true }).shape,
      name: z
        .string()
        .min(1)
        .pipe(uniqueField({ existing: existingTaskTypes, fieldName: "name" })),
    })
    .strict();

  return z.discriminatedUnion("valueKind", [
    z
      .object({
        valueKind: z.literal("boolean"),
        ...baseSchema.shape,
      })
      .strict(),
    z
      .object({
        valueKind: z.literal("number"),
        ...baseSchema.shape,
        ...argsSchema.pick({ unitId: true }).shape,
        ...argsSchema
          .pick({ initialNumValue: true, completedNumValue: true })
          .required().shape,
      })
      .strict()
      .superRefine(checkEqualInitialAndCompletedNumValues),
    z
      .object({
        valueKind: z.literal("enum"),
        ...baseSchema.shape,
        taskTypeEnumOptions: z
          .array(z.object({ name: z.string().min(1) }).strict())
          .min(2),
      })
      .strict(),
  ]);
}

export type CreateTaskTypeArgs = z.infer<
  ReturnType<typeof getCreateTaskTypeZodSchema>
>;

export const updateTaskTypeConvexSchema = v.object({
  taskTypeId: taskTypeConvexSchema.fields._id,
  ...pick(taskTypeConvexSchema.fields, [
    "name",
    "initialNumValue",
    "completedNumValue",
    "unitId",
  ]),
  taskTypeEnumOptions: v.optional(
    v.array(
      v.object({
        ...pick(taskTypeEnumOptionConvexSchema.fields, ["name"]),
        ...partial(pick(taskTypeEnumOptionConvexSchema.fields, ["_id"])),
      })
    )
  ),
  tags: v.array(v.id("tags")),
});

export function getUpdateTaskTypeZodSchema({
  existingTaskTypes,
  currentTaskTypeId,
}: {
  existingTaskTypes: TaskType[];
  currentTaskTypeId: TaskType["_id"];
}) {
  const argsSchema = convexToZod(updateTaskTypeConvexSchema);
  const baseSchema = z.object({
    ...argsSchema.pick({ tags: true }).shape,
    name: z
      .string()
      .min(1)
      .pipe(
        uniqueField({
          existing: existingTaskTypes,
          fieldName: "name",
          currentId: currentTaskTypeId,
        })
      ),
  });

  return z.discriminatedUnion("valueKind", [
    z
      .object({
        valueKind: z.literal("boolean"),
        ...baseSchema.shape,
      })
      .strict(),
    z
      .object({
        valueKind: z.literal("number"),
        ...baseSchema.shape,
        ...argsSchema.pick({ unitId: true }).shape,
        ...argsSchema
          .pick({ initialNumValue: true, completedNumValue: true })
          .required().shape,
      })
      .strict()
      .superRefine(checkEqualInitialAndCompletedNumValues),
    z
      .object({
        valueKind: z.literal("enum"),
        ...baseSchema.shape,
        taskTypeEnumOptions: z
          .array(
            z
              .object({
                name: z.string().min(1),
                _id: convexToZod(
                  taskTypeEnumOptionConvexSchema
                ).shape._id.optional(),
              })
              .strict()
          )
          .min(2),
      })
      .strict(),
  ]);
}

export type UpdateTaskTypeArgs = z.infer<
  ReturnType<typeof getUpdateTaskTypeZodSchema>
>;

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
