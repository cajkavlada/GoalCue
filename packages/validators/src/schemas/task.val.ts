import { pick } from "convex-helpers";
import { convexToZod } from "convex-helpers/server/zod4";
import { Infer, v } from "convex/values";
import z from "zod";

import { convexSchemaFromTable } from "../utils/dbSchemaHelpers";
import { priorityClassConvexSchema } from "./priorityClass.val";
import { tagConvexSchema } from "./tag.val";
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
  tags: v.array(tagConvexSchema),
});

export type ExtendedTask = Infer<typeof extendedTaskConvexSchema>;

// create task convex schema
export const createTaskConvexSchema = v.object({
  ...pick(taskConvexSchema, [
    "title",
    "description",
    "taskTypeId",
    "priorityClassId",
    "repetitionId",
    "dueAt",
    "initialNumValue",
    "completedNumValue",
  ]),
  tags: v.array(v.id("tags")),
});

const createArgsSchema = convexToZod(createTaskConvexSchema);

export const createTaskZodSchema = z
  .object({
    ...createArgsSchema.pick({
      description: true,
      taskTypeId: true,
      priorityClassId: true,
      repetitionId: true,
      initialNumValue: true,
      completedNumValue: true,
      tags: true,
    }).shape,
    title: z.string().min(1),
    dueAt: z.date().optional(),
  })
  .superRefine(checkEqualInitialAndCompletedNumValues);

export type CreateTaskArgs = z.infer<typeof createTaskZodSchema>;

// zod schema for task with correct values
const taskWithoutNumValues = createTaskZodSchema.omit({
  initialNumValue: true,
  completedNumValue: true,
}).shape;

export const taskWithCorrectValuesSchema = z.discriminatedUnion("valueKind", [
  z
    .object({
      valueKind: z.literal("boolean"),
      ...taskWithoutNumValues,
    })
    .strict(),
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
      valueKind: z.literal("enum"),
      ...taskWithoutNumValues,
    })
    .strict(),
]);

export const updateTaskConvexSchema = v.object({
  taskId: taskConvexSchema._id,
  ...pick(taskConvexSchema, [
    "title",
    "description",
    "priorityClassId",
    "repetitionId",
    "dueAt",
    "initialNumValue",
    "completedNumValue",
  ]),
  tags: v.array(v.id("tags")),
});

const updateArgsSchema = convexToZod(updateTaskConvexSchema);

export const updateTaskZodSchema = z
  .object({
    ...updateArgsSchema.pick({
      description: true,
      priorityClassId: true,
      repetitionId: true,
      initialNumValue: true,
      completedNumValue: true,
      tags: true,
    }).shape,
    title: z.string().min(1),
    dueAt: z.date().optional(),
  })
  .superRefine(checkEqualInitialAndCompletedNumValues);

export type UpdateTaskArgs = z.infer<typeof updateTaskZodSchema>;
