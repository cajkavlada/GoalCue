import { useStore } from "@tanstack/react-form";

import type { FieldError } from "../types/field-error";
import { useFormContext } from "../use-app-form";

export function FormErrors({ path }: { path: string }) {
  const form = useFormContext();
  const pathErrors: FieldError[] =
    useStore(form.store, (state) => state.errors?.[0]?.[path]) ?? [];

  return pathErrors.map((error, index) => (
    <p
      key={index}
      className="text-sm text-red-500"
    >
      {typeof error === "string" ? error : error?.message || "Unknown error"}
    </p>
  ));
}
