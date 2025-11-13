import { z } from "zod";

import { CUSTOM_ERROR_REASONS } from "./customErrorReasons";

export function uniqueField<IdType extends string, T extends { _id?: IdType }>({
  existing,
  fieldName,
  currentId,
}: {
  existing: T[];
  fieldName: keyof T;
  currentId?: IdType;
}) {
  return z
    .string()
    .refine(
      (value) =>
        !existing.some(
          (item) =>
            typeof item[fieldName] === "string" &&
            (item[fieldName] as string).toLowerCase() === value.toLowerCase() &&
            (currentId === undefined || item._id !== currentId)
        ),
      { params: { reason: CUSTOM_ERROR_REASONS.NOT_UNIQUE } }
    );
}
