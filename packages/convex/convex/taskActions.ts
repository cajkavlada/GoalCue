import { ConvexError } from "convex/values";

import {
  addTaskActionAdvancedSchema,
  addTaskActionConvexSchema,
  taskActionWithValuesSchema,
} from "@gc/validators";

import { Doc, Id } from "./_generated/dataModel";
import { checkTask } from "./tasks";
import { authedMutation } from "./utils/authedFunctions";
import { parsedHandler } from "./utils/parsedHandler";

export const add = authedMutation({
  args: addTaskActionConvexSchema,
  rateLimit: { name: "addTaskAction" },
  handler: parsedHandler(addTaskActionAdvancedSchema, async (ctx, input) => {
    const { taskId, ...action } = input;
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
  }),
});

function checkTaskValues(
  data: Pick<Doc<"taskActions">, "boolValue" | "numValue" | "enumOptionId"> &
    Pick<Doc<"tasks">, "valueKind" | "initialNumValue" | "completedNumValue"> &
    Pick<Doc<"taskTypes">, "completedEnumOptionId">
) {
  const parseValuesError = new ConvexError({
    message: `Provide correct value for a task action. Value kind is ${data.valueKind}.`,
  });
  const parsed = taskActionWithValuesSchema.safeParse(data);

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
