// import { pick } from "convex-helpers";
// import { doc } from "convex-helpers/validators";
// import { ConvexError } from "convex/values";
// import z from "zod";

// import { Doc, Id } from "./_generated/dataModel";
// import schema from "./schema";
// import { checkTask } from "./tasks";
// import { authedMutation, AuthedMutationCtx } from "./utils/authedFunctions";
// import { rateLimit } from "./utils/rateLimiter";

// const taskActionsSchema = doc(schema, "taskActions").fields;

// const taskActionValueZodSchema = z.discriminatedUnion("valueKind", [
//   z
//     .object({
//       valueKind: z.literal("boolean"),
//       booleanValue: z.boolean(),
//     })
//     .strict(),
//   z
//     .object({
//       valueKind: z.literal("number"),
//       numValue: z.number(),
//     })
//     .strict(),
//   z
//     .object({
//       valueKind: z.literal("enum"),
//       enumOptionId: z.string(),
//     })
//     .strict(),
// ]);

// type TaskActionValue = z.infer<typeof taskActionValueZodSchema>;

// export const add = authedMutation({
//   args: pick(taskActionsSchema, [
//     "taskId",
//     "booleanValue",
//     "numValue",
//     "enumOptionId",
//     "note",
//   ]),
//   handler: async (ctx, input) => {
//     const { taskId, ...action } = input;
//     const task = await checkTask(ctx, taskId);
//     const taskType = await ctx.db.get(task.taskTypeId);

//     const checked = check({valueKind: task.valueKind, ...action});

//     const completed = await isCompleted(
//       task,
//       { ...parsed.data, valueKind: task.valueKind },
//       ctx
//     );

//     await rateLimit(ctx, "addTaskAction");

//     await ctx.db.patch(taskId, completed);
//     return await ctx.db.insert("taskActions", input);
//   },
// });

// const schema = z.discriminatedUnion("valueKind", [
//   z
//     .object({
//       valueKind: z.literal("boolean"),
//       booleanValue: z.boolean(),
//     })
//     .strict(),
//   z
//     .object({
//       valueKind: z.literal("number"),
//       numValue: z.number(),
//       initialNumValue: z.number(),
//       completedNumValue: z.number(),
//     })
//     .strict(),
//   z
//     .object({
//       valueKind: z.literal("enum"),
//       enumOptionId: z.string(),
//       completedEnumOptionId: z.string(),
//     })
//     .strict(),
// ]);

// function check(
//   value: Pick<
//     Doc<"taskActions">,
//     "booleanValue" | "numValue" | "enumOptionId"
//   > &
//     Pick<Doc<"tasks">, "valueKind">
// ) {
//   value.
//   const parsed = schema.safeParse(value);
//   if (parsed.error) {
//     throw new ConvexError({
//       message: `Provide only correct value for a task action. Value kind is ${value.valueKind}.`,
//     });
//   }
//   if (parsed.data.valueKind === "boolean") {
//     return {
//       completed: parsed.data.booleanValue,
//     };
//   }
//   if (parsed.data.valueKind === "number") {
//     return {
//       completed:
//         (parsed.data.completedNumValue >= parsed.data.initialNumValue &&
//           parsed.data.numValue >= parsed.data.completedNumValue) ||
//         (parsed.data.completedNumValue <= parsed.data.initialNumValue &&
//           parsed.data.numValue <= parsed.data.completedNumValue),
//       currentNumValue: parsed.data.numValue,
//     };
//   }
//   if (parsed.data.valueKind === "enum") {
//     return {
//       completed: parsed.data.enumOptionId === parsed.data.completedEnumOptionId,
//       currentEnumOptionId: parsed.data.enumOptionId,
//     };
//   }
// }

// const taskValuesZodSchema = z.discriminatedUnion("valueKind", [
//   z
//     .object({
//       valueKind: z.literal("boolean"),
//       completed: z.boolean(),
//     })
//     .strict(),
//   z
//     .object({
//       valueKind: z.literal("number"),
//       initialNumValue: z.number(),
//       completedNumValue: z.number(),
//     })
//     .strict(),
//   z
//     .object({
//       valueKind: z.literal("enum"),
//       completedEnumOptionId: z.string(),
//     })
//     .strict(),
// ]);

// type TaskValue = z.infer<typeof taskValuesZodSchema>;

// async function isCompleted(
//   task: TaskValue,
//   action: TaskActionValue,
//   ctx: AuthedMutationCtx
// ) {
//   if (action.valueKind === "boolean") {
//     return action.booleanValue;
//   }
//   if (task.valueKind === "number" && action.valueKind === "number") {
//     return (
//       (task.completedNumValue >= task.initialNumValue &&
//         action.numValue >= task.completedNumValue) ||
//       (task.completedNumValue <= task.initialNumValue &&
//         action.numValue <= task.completedNumValue)
//     );
//   }
//   if (action.valueKind === "enum") {
//     const taskType = await ctx.db.get(task.taskTypeId);
//     if (!taskType) {
//       throw new ConvexError({
//         message: `Task type not found.`,
//       });
//     }

//     return (
//       taskType.completedEnumOptionId &&
//       taskType.completedEnumOptionId === action.enumOptionId
//     );
//   }
// }
