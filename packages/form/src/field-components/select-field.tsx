import { Label, Select as UISelect } from "@gc/ui";
import { cn } from "@gc/utils";

import { useFieldContext } from "../use-app-form";
import { FieldErrors } from "./field-errors";

export function SelectField<T extends string>({
  label,
  className,
  options,
  onValueChange,
}: {
  label: string;
  className?: string;
  options: { label: string; value: T }[];
  onValueChange?: (value: T) => void;
}) {
  const field = useFieldContext<string>();
  return (
    <div className={cn("flex flex-col", className)}>
      <Label htmlFor={field.name}>{label}</Label>
      <UISelect
        options={options}
        value={field.state.value}
        onValueChange={(val) => {
          field.handleChange(val);
          onValueChange?.(val as T);
        }}
      />
      <FieldErrors meta={field.state.meta} />
    </div>
  );
}
