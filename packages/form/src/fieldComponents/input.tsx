import { Label, Input as UIInput } from "@gc/ui";
import { cn } from "@gc/utils";

import { useFieldContext } from "../useAppForm";
import { FieldErrors } from "./field-errors";

export function Input({
  label,
  className,
  inputClassName,
  ...inputProps
}: {
  label: string;
  inputClassName?: string;
} & React.ComponentProps<"input">) {
  const field = useFieldContext<string>();

  return (
    <div className={cn("flex flex-col", className)}>
      <Label htmlFor={field.name}>{label}</Label>
      <UIInput
        className={inputClassName}
        id={field.name}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        value={field.state.value}
        {...inputProps}
      />
      <FieldErrors meta={field.state.meta} />
    </div>
  );
}
