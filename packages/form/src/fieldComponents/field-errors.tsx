import type { AnyFieldMeta } from "@tanstack/react-form";
import type { ZodError } from "zod";

export function FieldErrors({ meta }: { meta: AnyFieldMeta }) {
  if (!meta.isTouched) return null;

  return meta.errors.map((error: ZodError | string, index) => (
    <p
      key={index}
      className="text-sm text-red-500"
    >
      {typeof error === "string" ? error : error?.message || "Unknown error"}
    </p>
  ));
}
