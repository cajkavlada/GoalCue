import { Label, MultiSelect } from "@gc/ui";
import { cn } from "@gc/utils";

import { useFieldContext } from "../use-app-form";
import { FieldErrors } from "./field-errors";

export function MultiSelectField<
  T extends string,
  C extends string | undefined,
>({
  label,
  className,
  onValueChange,
  ...props
}: {
  label: string;
  className?: string;
  options: { label: string; value: T; color?: C }[];
  onValueChange?: (value: T[]) => void;
  placeholder?: string;
  emptyMessage: string;
}) {
  const field = useFieldContext<T[]>();
  return (
    <div className={cn("flex flex-col", className)}>
      <Label htmlFor={field.name}>{label}</Label>
      <MultiSelect
        value={field.state.value}
        onValueChange={(val) => {
          field.handleChange(val);
          onValueChange?.(val);
        }}
        {...props}
      />
      <FieldErrors meta={field.state.meta} />
    </div>
  );
}
