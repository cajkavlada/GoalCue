import { v } from "convex/values";
import { generateNKeysBetween } from "fractional-indexing";

import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

const defaultKeys = generateNKeysBetween(null, null, 3);

const initPriorityClasses = [
  {
    name: "High",
    color: "red",
    order: defaultKeys[0]!,
  },
  {
    name: "Medium",
    color: "yellow",
    order: defaultKeys[1]!,
  },
  {
    name: "Low",
    color: "green",
    order: defaultKeys[2]!,
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
    taskTypes: [{ name: "Todo", initialValue: false, completedValue: true }],
    unit: {
      name: "Boolean",
      valueType: "boolean",
    },
  },
  {
    taskTypes: [{ name: "Number" }],
    unit: {
      name: "Count",
      valueType: "number",
    },
  },
  {
    taskTypes: [{ name: "Percentage", initialValue: 0, completedValue: 100 }],
    unit: {
      name: "Percent",
      symbol: "%",
      valueType: "number",
    },
  },
  {
    taskTypes: [{ name: "Time" }],
    unit: {
      name: "Minute",
      symbol: "min",
      valueType: "number",
    },
  },
  {
    taskTypes: [{ name: "Distance" }],
    unit: {
      name: "Kilometer",
      symbol: "km",
      valueType: "number",
    },
  },
  {
    taskTypes: [{ name: "Pages" }],
    unit: {
      name: "Page",
      symbol: "pg",
      valueType: "number",
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
        .first()) !== null
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
