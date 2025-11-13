import { pick } from "convex-helpers";
import { partial } from "convex-helpers/validators";
import { Infer, v } from "convex/values";
import z from "zod";

import { CUSTOM_ERROR_REASONS } from "../utils/customErrorReasons";
import { convexSchemaFromTable } from "../utils/dbSchemaHelpers";
import { uniqueField } from "../utils/zodHelpers";
import { zid } from "../utils/zodv4Helpers";
import { taskTypeEnumOptionConvexSchema } from "./taskTypeEnumOptionVal";

export const taskTypeConvexSchema = convexSchemaFromTable("taskTypes");

export type TaskType = Infer<typeof taskTypeConvexSchema>;

export const extendedTaskTypeConvexSchema = v.object({
  ...taskTypeConvexSchema.fields,
  taskTypeEnumOptions: v.optional(v.array(taskTypeEnumOptionConvexSchema)),
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
});

// TODO: infer from convex schema when convexToZod supports zod v4
export function getCreateTaskTypeZodSchema({
  existingTaskTypes,
}: {
  existingTaskTypes: TaskType[];
}) {
  const uniqueName = z
    .string()
    .min(1)
    .pipe(uniqueField({ existing: existingTaskTypes, fieldName: "name" }));

  return z.union([
    z
      .object({
        name: uniqueName,
        valueKind: z.literal("boolean"),
      })
      .strict(),
    z
      .object({
        name: uniqueName,
        valueKind: z.literal("number"),
        initialNumValue: z.number(),
        completedNumValue: z.number(),
        unitId: zid("units").optional(),
      })
      .strict()
      .superRefine(checkEqualInitialAndCompletedNumValues),
    z
      .object({
        name: uniqueName,
        valueKind: z.literal("enum"),
        taskTypeEnumOptions: z
          .array(
            z.object({
              name: z.string().min(1),
            })
          )
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
  archivedTaskTypeEnumOptions: v.optional(
    v.array(taskTypeEnumOptionConvexSchema.fields._id)
  ),
});

export function getUpdateTaskTypeZodSchema({
  existingTaskTypes,
  currentTaskTypeId,
}: {
  existingTaskTypes: TaskType[];
  currentTaskTypeId: TaskType["_id"];
}) {
  const uniqueName = z
    .string()
    .min(1)
    .pipe(
      uniqueField({
        existing: existingTaskTypes,
        fieldName: "name",
        currentId: currentTaskTypeId,
      })
    );
  return z.union([
    z
      .object({
        name: uniqueName,
        valueKind: z.literal("boolean"),
      })
      .strict(),
    z
      .object({
        name: uniqueName,
        valueKind: z.literal("number"),
        initialNumValue: z.number(),
        completedNumValue: z.number(),
        unitId: zid("units").optional(),
      })
      .strict()
      .superRefine(checkEqualInitialAndCompletedNumValues),
    z
      .object({
        name: uniqueName,
        valueKind: z.literal("enum"),
        taskTypeEnumOptions: z
          .array(
            z.object({
              name: z.string().min(1),
              _id: zid("taskTypeEnumOptions").optional(),
            })
          )
          .min(2),
        archivedTaskTypeEnumOptions: z.array(zid("taskTypeEnumOptions")),
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
