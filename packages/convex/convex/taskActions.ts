import { pick } from "convex-helpers";
import { doc } from "convex-helpers/validators";

import schema from "./schema";
import { checkTask, checkValueTypes } from "./tasks";
import { authedMutation } from "./utils/authedFunctions";
import { rateLimit } from "./utils/rateLimiter";

const taskActionsSchema = doc(schema, "taskActions").fields;

export const add = authedMutation({
  args: pick(taskActionsSchema, ["taskId", "value", "note"]),
  handler: async (ctx, input) => {
    const { taskId, value } = input;
    const task = await checkTask(ctx, taskId);
    checkValueTypes(ctx, task, value);
    await rateLimit(ctx, "addTaskAction");

    await ctx.db.patch(taskId, { currentValue: value });
    return await ctx.db.insert("taskActions", input);
  },
});
