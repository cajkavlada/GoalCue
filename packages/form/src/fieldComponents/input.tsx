import { Label, Input as UIInput } from "@gc/ui";
import { cn } from "@gc/utils";

import { useFieldContext } from "../useAppForm";
import { FieldErrors } from "./field-errors";

export function Input({
  label,
  className,
  inputClassName,
  type,
  ...inputProps
}: {
  label: string;
  inputClassName?: string;
} & React.ComponentProps<"input">) {
  const field = useFieldContext<string | number>();

  const handleChange = (value: string) => {
    if (type === "number" && value !== "" && value !== "-") {
      // Allow empty string and "-" for better UX, otherwise parse as number
      const numValue = Number(value);
      field.handleChange(isNaN(numValue) ? value : numValue);
    } else {
      field.handleChange(value);
    }
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <Label htmlFor={field.name}>{label}</Label>
      <UIInput
        className={inputClassName}
        id={field.name}
        type={type}
        onBlur={field.handleBlur}
        onChange={(e) => handleChange(e.target.value)}
        value={field.state.value ?? ""}
        {...inputProps}
      />
      <FieldErrors meta={field.state.meta} />
    </div>
  );
}
