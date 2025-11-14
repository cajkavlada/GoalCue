import { pick } from "convex-helpers";
import { partial } from "convex-helpers/validators";
import { Infer, v } from "convex/values";
import z from "zod";

import { convexSchemaFromTable } from "../utils/dbSchemaHelpers";
import { zid } from "../utils/zodv4Helpers";
import { priorityClassConvexSchema } from "./priorityClass.val";
import {
  checkEqualInitialAndCompletedNumValues,
  taskTypeConvexSchema,
} from "./taskType.val";
import { taskTypeEnumOptionConvexSchema } from "./taskTypeEnumOption.val";

export const taskConvexSchema = convexSchemaFromTable("tasks").fields;

export const extendedTaskConvexSchema = v.object({
  ...taskConvexSchema,
  taskType: taskTypeConvexSchema,
  priorityClass: priorityClassConvexSchema,
  enumOptions: v.optional(v.array(taskTypeEnumOptionConvexSchema)),
});

export type ExtendedTask = Infer<typeof extendedTaskConvexSchema>;

// create task convex schema
export const createTaskConvexSchema = v.object(
  pick(taskConvexSchema, [
    "title",
    "description",
    "taskTypeId",
    "priorityClassId",
    "repetitionId",
    "dueAt",
    "initialNumValue",
    "completedNumValue",
  ])
);

// TODO: infer from convex schema when convexToZod supports zod v4
export const createTaskZodSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().optional(),
    taskTypeId: zid("taskTypes"),
    priorityClassId: zid("priorityClasses"),
    repetitionId: zid("repetitions").optional(),
    dueAt: z.date().optional(),
    initialNumValue: z.number().optional(),
    completedNumValue: z.number().optional(),
  })
  .superRefine(checkEqualInitialAndCompletedNumValues);

export type CreateTaskArgs = z.infer<typeof createTaskZodSchema>;

// zod schema for task with correct values
const taskWithoutNumValues = createTaskZodSchema.omit({
  initialNumValue: true,
  completedNumValue: true,
}).shape;

export const taskWithCorrectValuesSchema = z.union([
  z
    .object({
      valueKind: z.literal("number"),
      ...taskWithoutNumValues,
      ...createTaskZodSchema.required().pick({
        initialNumValue: true,
        completedNumValue: true,
      }).shape,
    })
    .strict(),
  z
    .object({
      valueKind: z.literal("boolean"),
      ...taskWithoutNumValues,
    })
    .strict(),
  z
    .object({
      valueKind: z.literal("enum"),
      ...taskWithoutNumValues,
    })
    .strict(),
]);

export const updateTaskConvexSchema = v.object({
  taskId: taskConvexSchema._id,
  ...partial(
    pick(taskConvexSchema, [
      "title",
      "description",
      "priorityClassId",
      "priorityIndex",
      "repetitionId",
      "dueAt",
      "initialNumValue",
      "completedNumValue",
    ])
  ),
});

export const updateTaskZodSchema = z
  .object({
    title: z.string(),
    description: z.string(),
    priorityClassId: zid("priorityClasses"),
    repetitionId: zid("repetitions"),
    dueAt: z.date(),
    initialNumValue: z.number(),
    completedNumValue: z.number(),
  })
  .partial()
  .superRefine(checkEqualInitialAndCompletedNumValues);

export type UpdateTaskArgs = z.infer<typeof updateTaskZodSchema>;
