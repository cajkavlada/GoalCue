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
    "projectId",
    "milestoneId",
    "description",
    "taskTypeId",
    "priorityClassId",
    "repetitionId",
    "recurrence",
    "dueAt",
    "effortMinutes",
    "minSessionMinutes",
    "maxSessionMinutes",
    "automaticSchedulingPaused",
    "priority",
    "finishKind",
    "progressMeasure",
    "progressUnit",
    "initialNumValue",
    "completedNumValue",
  ]),
  tags: v.array(v.id("tags")),
});

const createArgsSchema = convexToZod(createTaskConvexSchema);

export const createTaskZodSchema = z
  .object({
    ...createArgsSchema.pick({
      priority: true,
      projectId: true,
      milestoneId: true,
      automaticSchedulingPaused: true,
      finishKind: true,
      progressMeasure: true,
      progressUnit: true,
      description: true,
      taskTypeId: true,
      priorityClassId: true,
      repetitionId: true,
      recurrence: true,
      initialNumValue: true,
      completedNumValue: true,
      tags: true,
    }).shape,
    effortMinutes: z.number().positive().finite().optional(),
    minSessionMinutes: z.number().int().min(1).max(1440).optional(),
    maxSessionMinutes: z.number().int().min(1).max(1440).optional(),
    title: z.string().min(1),
    dueAt: z.date().optional(),
  })
  .superRefine(checkEqualInitialAndCompletedNumValues)
  .refine(
    (task) => (task.minSessionMinutes ?? 15) <= (task.maxSessionMinutes ?? 60),
    {
      message: "Minimum Session duration must not exceed maximum",
      params: { reason: "Minimum Session duration must not exceed maximum" },
      path: ["minSessionMinutes"],
    }
  );

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
  editScope: v.optional(v.union(v.literal("future"), v.literal("occurrence"))),
  ...pick(taskConvexSchema, [
    "title",
    "projectId",
    "milestoneId",
    "description",
    "priorityClassId",
    "repetitionId",
    "recurrence",
    "dueAt",
    "effortMinutes",
    "minSessionMinutes",
    "maxSessionMinutes",
    "automaticSchedulingPaused",
    "priority",
    "finishKind",
    "progressMeasure",
    "progressUnit",
    "initialNumValue",
    "completedNumValue",
  ]),
  tags: v.array(v.id("tags")),
});

const updateArgsSchema = convexToZod(updateTaskConvexSchema);

export const updateTaskZodSchema = z
  .object({
    ...updateArgsSchema.pick({
      priority: true,
      projectId: true,
      milestoneId: true,
      automaticSchedulingPaused: true,
      finishKind: true,
      progressMeasure: true,
      progressUnit: true,
      description: true,
      priorityClassId: true,
      repetitionId: true,
      recurrence: true,
      initialNumValue: true,
      completedNumValue: true,
      tags: true,
    }).shape,
    effortMinutes: z.number().positive().finite().optional(),
    minSessionMinutes: z.number().int().min(1).max(1440).optional(),
    maxSessionMinutes: z.number().int().min(1).max(1440).optional(),
    title: z.string().min(1),
    dueAt: z.date().optional(),
  })
  .superRefine(checkEqualInitialAndCompletedNumValues)
  .refine(
    (task) => (task.minSessionMinutes ?? 15) <= (task.maxSessionMinutes ?? 60),
    {
      message: "Minimum Session duration must not exceed maximum",
      params: { reason: "Minimum Session duration must not exceed maximum" },
      path: ["minSessionMinutes"],
    }
  );

export type UpdateTaskArgs = z.infer<typeof updateTaskZodSchema>;
