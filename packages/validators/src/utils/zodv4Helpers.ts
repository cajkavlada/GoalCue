/* eslint-disable @typescript-eslint/no-explicit-any */
import { GenericDataModel, TableNamesInDataModel } from "convex/server";
import { GenericId } from "convex/values";
import { z } from "zod";

/**
 * Create a validator for a Convex `Id` using v4's custom type approach.
 *
 * When used as a validator, it will check that it's for the right table.
 * When used as a parser, it will only check that the Id is a string.
 *
 * @param tableName - The table that the `Id` references. i.e.` Id<tableName>`
 * @returns - A Zod object representing a Convex `Id`
 */
export const zid = <
  DataModel extends GenericDataModel = GenericDataModel,
  TableName extends
    TableNamesInDataModel<DataModel> = TableNamesInDataModel<DataModel>,
>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tableName: TableName
) => {
  return z.string() as unknown as z.ZodType<
    GenericId<TableName>,
    GenericId<TableName>
  >;
};

export type Zid<TableName extends string> = ReturnType<
  typeof zid<GenericDataModel, TableName>
>;

export function zBrand<T extends z.ZodType, B extends string | number | symbol>(
  schema: T,
  brand: B
) {
  // Create a transform schema that includes brand information
  const branded = schema.transform((val) => val as z.output<T> & z.BRAND<B>);

  // Store brand metadata AND the original schema for conversion
  registryHelpers.setMetadata(branded, {
    brand: String(brand),
    originalSchema: schema, // Store the original schema so we can convert it properly
  });

  return branded;
}

type ConvexSchemaMetadata = {
  description?: string;
  deprecated?: boolean;
  version?: string;
  tags?: string[];
  example?: string;
  tableName?: string; // for Zid types
  generateJsonSchema?: boolean;
  // Store JSON schema directly in metadata since v4 registry handles one object per schema
  jsonSchema?: Record<string, any>;
  [key: string]: any;
};

// Global registry instance using actual Zod v4 API
export const globalRegistry = z.registry<ConvexSchemaMetadata>();

// Helper functions to maintain backward compatibility with our existing API
export const registryHelpers = {
  setMetadata(schema: z.ZodType, metadata: Record<string, any>): void {
    const existing = globalRegistry.get(schema) || {};
    globalRegistry.add(schema, { ...existing, ...metadata });
  },

  getMetadata(schema: z.ZodType): Record<string, any> | undefined {
    const metadata = globalRegistry.get(schema);
    if (!metadata) return undefined;

    // Extract non-jsonSchema properties for backward compatibility
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { jsonSchema, ...rest } = metadata;
    return rest;
  },

  setJsonSchema(schema: z.ZodType, jsonSchema: Record<string, any>): void {
    const existing = globalRegistry.get(schema) || {};
    globalRegistry.add(schema, { ...existing, jsonSchema });
  },

  getJsonSchema(schema: z.ZodType): Record<string, any> | undefined {
    return globalRegistry.get(schema)?.jsonSchema;
  },

  register(id: string, schema: z.ZodType): void {
    // v4 registry is schema-keyed, not string-keyed
    // Store the ID in the metadata for backward compatibility
    const existing = globalRegistry.get(schema) || {};
    globalRegistry.add(schema, { ...existing, registryId: id });
  },
};
