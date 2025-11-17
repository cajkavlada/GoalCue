import { pick } from "convex-helpers";
import { Infer, v } from "convex/values";
import z from "zod";

import { TAG_COLORS } from "@gc/db";

import { convexSchemaFromTable } from "../utils/dbSchemaHelpers";
import { uniqueField } from "../utils/zodHelpers";

export const tagConvexSchema = convexSchemaFromTable("tags");

export type Tag = Infer<typeof tagConvexSchema>;

export const createTagConvexSchema = v.object(
  pick(tagConvexSchema.fields, ["name", "color", "kind"])
);

export function getCreateTagZodSchema({
  existingTags,
}: {
  existingTags: Tag[];
}) {
  return z
    .object({
      name: z
        .string()
        .min(1)
        .pipe(uniqueField({ existing: existingTags, fieldName: "name" })),
      color: z.enum(TAG_COLORS.map((color) => color.value)).optional(),
      kind: z
        .enum(["project", "area", "context", "timeframe", "label"])
        .optional(),
    })
    .strict();
}

export type CreateTagArgs = z.infer<ReturnType<typeof getCreateTagZodSchema>>;

export const updateTagConvexSchema = v.object({
  tagId: tagConvexSchema.fields._id,
  ...pick(tagConvexSchema.fields, ["name", "color", "kind"]),
});

export function getUpdateTagZodSchema({
  existingTags,
  currentTagId,
}: {
  existingTags: Tag[];
  currentTagId: Tag["_id"];
}) {
  return z
    .object({
      name: z
        .string()
        .min(1)
        .pipe(
          uniqueField({
            existing: existingTags,
            fieldName: "name",
            currentId: currentTagId,
          })
        ),
      color: z.enum(TAG_COLORS.map((color) => color.value)).optional(),
      kind: z
        .enum(["project", "area", "context", "timeframe", "label"])
        .optional(),
    })
    .strict();
}

export type UpdateTagArgs = z.infer<ReturnType<typeof getUpdateTagZodSchema>>;
