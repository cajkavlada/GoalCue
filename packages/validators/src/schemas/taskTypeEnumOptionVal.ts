import { Infer } from "convex/values";

import { convexSchemaFromTable } from "../utils/dbSchemaHelpers";

export const taskTypeEnumOptionConvexSchema = convexSchemaFromTable(
  "taskTypeEnumOptions"
);

export type TaskTypeEnumOption = Infer<typeof taskTypeEnumOptionConvexSchema>;
