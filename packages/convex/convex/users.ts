import { v } from "convex/values";
import { generateNKeysBetween } from "fractional-indexing";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

const priorityClassDefaultKeys = generateNKeysBetween(null, null, 3);
const articleWorkflowEnumDefaultKeys = generateNKeysBetween(null, null, 6);

type PriorityClass = Required<
  Omit<
    Doc<"priorityClasses">,
    "_id" | "_creationTime" | "userId" | "archivedAt"
  >
>;

const initPriorityClasses: PriorityClass[] = [
  {
    name: "High",
    color: "red",
    orderKey: priorityClassDefaultKeys[0]!,
    i18nKey: "priorityClasses_high",
  },
  {
    name: "Medium",
    color: "yellow",
    orderKey: priorityClassDefaultKeys[1]!,
    i18nKey: "priorityClasses_medium",
  },
  {
    name: "Low",
    color: "green",
    orderKey: priorityClassDefaultKeys[2]!,
    i18nKey: "priorityClasses_low",
  },
];

type Unit = Omit<Doc<"units">, "_id" | "_creationTime" | "userId">;
type TaskTypeEnumOption = Omit<
  Doc<"taskTypeEnumOptions">,
  "_id" | "_creationTime" | "taskTypeId"
> & { initial?: boolean; completed?: boolean };
type TaskType = Omit<
  Doc<"taskTypes">,
  "_id" | "_creationTime" | "userId" | "unitId"
> & { taskTypeEnumOptions?: TaskTypeEnumOption[] };
type TaskTypesForUnits = { unit?: Unit; taskTypes: TaskType[] }[];

const initTaskTypes: TaskTypesForUnits = [
  {
    taskTypes: [
      {
        name: "Todo",
        i18nKey: "taskTypes_todo",
        valueKind: "boolean",
      },
    ],
  },
  {
    taskTypes: [
      {
        name: "Percentage",
        i18nKey: "taskTypes_percentage",
        valueKind: "number",
        initialNumValue: 0,
        completedNumValue: 100,
      },
    ],
    unit: {
      name: "Percent",
      i18nKey: "units_percent",
      symbol: "%",
    },
  },
  {
    taskTypes: [
      {
        name: "Time",
        i18nKey: "taskTypes_time",
        valueKind: "number",
        initialNumValue: 0,
        completedNumValue: 60,
      },
    ],
    unit: {
      name: "Minute",
      i18nKey: "units_minute",
      symbol: "min",
    },
  },
  {
    taskTypes: [
      {
        name: "Distance",
        i18nKey: "taskTypes_distance",
        valueKind: "number",
        initialNumValue: 0,
        completedNumValue: 10,
      },
    ],
    unit: {
      name: "Kilometer",
      i18nKey: "units_kilometer",
      symbol: "km",
    },
  },
  {
    taskTypes: [
      {
        name: "Pages",
        i18nKey: "taskTypes_pages",
        valueKind: "number",
        initialNumValue: 0,
        completedNumValue: 100,
      },
    ],
    unit: {
      name: "Page",
      i18nKey: "units_page",
    },
  },
  {
    taskTypes: [
      {
        name: "Number",
        i18nKey: "taskTypes_number",
        valueKind: "number",
        initialNumValue: 0,
        completedNumValue: 10,
      },
    ],
    unit: {
      name: "Count",
      i18nKey: "units_count",
    },
  },
  {
    taskTypes: [
      {
        name: "Article Workflow",
        i18nKey: "taskTypes_articleWorkflow",
        valueKind: "enum",
        taskTypeEnumOptions: [
          {
            name: "Backlog",
            i18nKey: "enumOptions_backlog",
            orderKey: articleWorkflowEnumDefaultKeys[0]!,
            initial: true,
          },
          {
            name: "Draft",
            i18nKey: "enumOptions_draft",
            orderKey: articleWorkflowEnumDefaultKeys[1]!,
          },
          {
            name: "Review",
            i18nKey: "enumOptions_review",
            orderKey: articleWorkflowEnumDefaultKeys[2]!,
          },
          {
            name: "Revise",
            i18nKey: "enumOptions_revise",
            orderKey: articleWorkflowEnumDefaultKeys[3]!,
          },
          {
            name: "Approved",
            i18nKey: "enumOptions_approved",
            orderKey: articleWorkflowEnumDefaultKeys[4]!,
          },
          {
            name: "Published",
            i18nKey: "enumOptions_published",
            orderKey: articleWorkflowEnumDefaultKeys[5]!,
            completed: true,
          },
        ],
      },
    ],
  },
];

export const userExists = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    return (
      (await ctx.db
        .query("users")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique()) !== null
    );
  },
});

export const initUser = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    await ctx.db.insert("users", {
      userId: userId,
    });

    for (const priorityClass of initPriorityClasses) {
      await ctx.db.insert("priorityClasses", {
        ...priorityClass,
        userId,
      });
    }
    for (const { unit, taskTypes } of initTaskTypes) {
      let unitId: Id<"units"> | undefined;
      if (unit) {
        unitId = await ctx.db.insert("units", {
          ...unit,
          userId,
        });
      }
      for (const taskType of taskTypes) {
        const { taskTypeEnumOptions, ...rest } = taskType;
        const taskTypeWithUnitId = {
          ...rest,
          userId,
          unitId,
        };

        const taskTypeId = await ctx.db.insert("taskTypes", taskTypeWithUnitId);
        if (taskTypeEnumOptions) {
          let initialEnumOptionId: Id<"taskTypeEnumOptions"> | undefined;
          let completedEnumOptionId: Id<"taskTypeEnumOptions"> | undefined;

          for (const opt of taskTypeEnumOptions) {
            const { initial, completed, ...taskTypeEnumOption } = opt;
            const taskTypeEnumOptionId = await ctx.db.insert(
              "taskTypeEnumOptions",
              {
                ...taskTypeEnumOption,
                taskTypeId,
              }
            );
            if (initial) {
              initialEnumOptionId = taskTypeEnumOptionId;
            }
            if (completed) {
              completedEnumOptionId = taskTypeEnumOptionId;
            }
          }
          if (initialEnumOptionId && completedEnumOptionId) {
            await ctx.db.patch(taskTypeId, {
              initialEnumOptionId,
              completedEnumOptionId,
            });
          }
        }
      }
    }
  },
});
