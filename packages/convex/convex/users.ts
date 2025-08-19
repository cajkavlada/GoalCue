import { v } from "convex/values";
import { generateNKeysBetween } from "fractional-indexing";

import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

const defaultKeys = generateNKeysBetween(null, null, 3);

type PriorityClass = Required<
  Omit<Doc<"priorityClasses">, "_id" | "_creationTime" | "userId">
>;

const initPriorityClasses: PriorityClass[] = [
  {
    name: "High",
    color: "red",
    order: defaultKeys[0]!,
    i18nKey: "priorityClasses_high",
  },
  {
    name: "Medium",
    color: "yellow",
    order: defaultKeys[1]!,
    i18nKey: "priorityClasses_medium",
  },
  {
    name: "Low",
    color: "green",
    order: defaultKeys[2]!,
    i18nKey: "priorityClasses_low",
  },
];

type Unit = Omit<Doc<"units">, "_id" | "_creationTime" | "userId">;
type TaskType = Omit<
  Doc<"taskTypes">,
  "_id" | "_creationTime" | "userId" | "unitId"
>;
type TaskTypesForUnits = { unit: Unit; taskTypes: TaskType[] }[];

const initTaskTypes: TaskTypesForUnits = [
  {
    taskTypes: [
      {
        name: "Todo",
        initialValue: false,
        completedValue: true,
        i18nKey: "taskTypes_todo",
      },
    ],
    unit: {
      name: "Boolean",
      valueType: "boolean",
      i18nKey: "units_boolean",
    },
  },
  {
    taskTypes: [
      {
        name: "Percentage",
        initialValue: 0,
        completedValue: 100,
        i18nKey: "taskTypes_percentage",
      },
    ],
    unit: {
      name: "Percent",
      symbol: "%",
      valueType: "number",
      i18nKey: "units_percent",
    },
  },
  {
    taskTypes: [{ name: "Time", i18nKey: "taskTypes_time" }],
    unit: {
      name: "Minute",
      symbol: "min",
      valueType: "number",
      i18nKey: "units_minute",
    },
  },
  {
    taskTypes: [{ name: "Distance", i18nKey: "taskTypes_distance" }],
    unit: {
      name: "Kilometer",
      symbol: "km",
      valueType: "number",
      i18nKey: "units_kilometer",
    },
  },
  {
    taskTypes: [{ name: "Pages", i18nKey: "taskTypes_pages" }],
    unit: {
      name: "Page",
      symbol: "pg",
      valueType: "number",
      i18nKey: "units_page",
    },
  },
  {
    taskTypes: [{ name: "Number", i18nKey: "taskTypes_number" }],
    unit: {
      name: "Count",
      valueType: "number",
      i18nKey: "units_count",
    },
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
      const unitId = await ctx.db.insert("units", {
        ...unit,
        userId,
      });
      for (const taskType of taskTypes) {
        await ctx.db.insert("taskTypes", {
          ...taskType,
          unitId,
          userId,
        });
      }
    }
  },
});
