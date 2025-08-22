import { pick } from "convex-helpers";
import { doc } from "convex-helpers/validators";
import { ConvexError, Infer, v } from "convex/values";
import z from "zod";

import { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";
import { checkTask } from "./tasks";
import { authedMutation } from "./utils/authedFunctions";
import { rateLimit } from "./utils/rateLimiter";

const taskActionsSchema = doc(schema, "taskActions").fields;

const addSchema = v.object(
  pick(taskActionsSchema, [
    "taskId",
    "boolValue",
    "numValue",
    "enumOptionId",
    "note",
  ])
);

export type AddTaskActionArgs = Infer<typeof addSchema>;

export const add = authedMutation({
  args: addSchema,
  handler: async (ctx, input) => {
    const { taskId, ...action } = input;

    await rateLimit(ctx, "addTaskAction");
    const task = await checkTask(ctx, taskId);
    const taskType = await ctx.db.get(task.taskTypeId);
    if (!taskType) {
      throw new ConvexError({
        message: `Task type not found.`,
      });
    }

    const checkedNewTaskValues = checkTaskValues({
      valueKind: task.valueKind,
      ...action,
      ...(task.valueKind === "number"
        ? {
            completedNumValue: task.completedNumValue,
            initialNumValue: task.initialNumValue,
          }
        : {}),
      ...(task.valueKind === "enum"
        ? { completedEnumOptionId: taskType.completedEnumOptionId }
        : {}),
    });

    await ctx.db.patch(taskId, {
      ...checkedNewTaskValues,
      valueUpdatedAt: Date.now(),
    });
    return await ctx.db.insert("taskActions", input);
  },
});

const taskValuesSchema = z.discriminatedUnion("valueKind", [
  z
    .object({
      valueKind: z.literal("boolean"),
      boolValue: z.boolean(),
    })
    .strict(),
  z
    .object({
      valueKind: z.literal("number"),
      numValue: z.number(),
      initialNumValue: z.number(),
      completedNumValue: z.number(),
    })
    .strict(),
  z
    .object({
      valueKind: z.literal("enum"),
      enumOptionId: z.string(),
      completedEnumOptionId: z.string(),
    })
    .strict(),
]);

function checkTaskValues(
  data: Pick<Doc<"taskActions">, "boolValue" | "numValue" | "enumOptionId"> &
    Pick<Doc<"tasks">, "valueKind" | "initialNumValue" | "completedNumValue"> &
    Pick<Doc<"taskTypes">, "completedEnumOptionId">
) {
  const parseValuesError = new ConvexError({
    message: `Provide correct value for a task action. Value kind is ${data.valueKind}.`,
  });
  const parsed = taskValuesSchema.safeParse(data);

  if (parsed.error) {
    throw parseValuesError;
  }
  const values = parsed.data;
  if (values.valueKind === "boolean") {
    return {
      completed: values.boolValue,
    };
  }
  if (values.valueKind === "number") {
    return {
      completed:
        (values.completedNumValue >= values.initialNumValue &&
          values.numValue >= values.completedNumValue) ||
        (values.completedNumValue <= values.initialNumValue &&
          values.numValue <= values.completedNumValue),
      currentNumValue: values.numValue,
    };
  }
  if (values.valueKind === "enum") {
    return {
      completed: values.enumOptionId === values.completedEnumOptionId,
      currentEnumOptionId: values.enumOptionId as Id<"taskTypeEnumOptions">,
    };
  }
  throw parseValuesError;
}
