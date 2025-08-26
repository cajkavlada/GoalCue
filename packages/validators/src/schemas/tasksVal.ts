import { pick } from "convex-helpers";
import { Infer, v } from "convex/values";
import z from "zod";

import { convexSchemaFromTable } from "../utils/dbSchemaHelpers";

export const taskConvexSchema = convexSchemaFromTable("tasks").fields;

// extended task convex schema
const taskTypeConvexSchema = convexSchemaFromTable("taskTypes");
const priorityClassConvexSchema = convexSchemaFromTable("priorityClasses");
const taskTypeEnumOptionConvexSchema = convexSchemaFromTable(
  "taskTypeEnumOptions"
);

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

export type CreateTaskArgs = Infer<typeof createTaskConvexSchema>;

// zod schema for numValues when task type is number

// TODO: infer from convex schema when convexToZod supports zod v4
export const createTaskZodSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  taskTypeId: z.string(),
  priorityClassId: z.string(),
  repetitionId: z.string().optional(),
  dueAt: z.string().optional(),
  initialNumValue: z.number().optional(),
  completedNumValue: z.number().optional(),
});

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
      initialNumValue: z.number(),
      completedNumValue: z.number(),
    })
    .strict()
    .refine((data) => data.initialNumValue !== data.completedNumValue, {
      message: "initialNumValue and completedNumValue cannot be the same",
      path: ["completedNumValue"],
    }),
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
