import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { eventsDbSchema } from "./eventsDbSchema";
import { priorityClassDbSchema } from "./priorityClassDbSchema";
import { repetitionDbSchema } from "./repetitionDbSchema";
import { tagDbSchema } from "./tagDbSchema";
import { taskDbSchema } from "./taskDbSchema";
import { taskTypeDbSchema } from "./taskTypeDbSchema";

export const dbSchema = defineSchema({
  users: defineTable({
    userId: v.string(),
  }).index("by_user", ["userId"]),
  ...taskDbSchema,
  ...taskTypeDbSchema,
  ...priorityClassDbSchema,
  ...tagDbSchema,
  ...eventsDbSchema,
  ...repetitionDbSchema,
});
