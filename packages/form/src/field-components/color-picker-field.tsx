import { ColorPicker, Label } from "@gc/ui";
import { cn } from "@gc/utils";

import { useFieldContext } from "../use-app-form";
import { FieldErrors } from "./field-errors";

export function ColorPickerField<T extends string | undefined>({
  label,
  className,
  onValueChange,
  ...props
}: {
  label: string;
  className?: string;
  colors: readonly { label: string; value: T }[];
  onValueChange?: (value: T) => void;
  children?: React.ReactNode;
  placeholder?: string;
}) {
  const field = useFieldContext<T>();
  return (
    <div className={cn("flex flex-col", className)}>
      <Label htmlFor={field.name}>{label}</Label>
      <ColorPicker
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
