import { Infer } from "convex/values";

import { convexSchemaFromTable } from "../utils/dbSchemaHelpers";

export const priorityClassConvexSchema =
  convexSchemaFromTable("priorityClasses");

export type PriorityClass = Infer<typeof priorityClassConvexSchema>;
