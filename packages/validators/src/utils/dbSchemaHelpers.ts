import type {
  DataModelFromSchemaDefinition,
  TableNamesInDataModel,
} from "convex/server";
import { doc } from "convex-helpers/validators";

import { dbSchema } from "@gc/db";

type TableName = TableNamesInDataModel<
  DataModelFromSchemaDefinition<typeof dbSchema>
>;

export function convexSchemaFromTable<T extends TableName>(tableName: T) {
  return doc(dbSchema, tableName);
}

// TODO: uncomment when convexToZod supports zod v4
// export function zodSchemaFromTable<T extends TableName>(tableName: T) {
//   return convexToZod(doc(dbSchema, tableName));
// }
