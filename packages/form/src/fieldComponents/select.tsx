import {
  Label,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Select as UISelect,
} from "@gc/ui";
import { cn } from "@gc/utils";

import { useFieldContext } from "../useAppForm";
import { FieldErrors } from "./field-errors";

export function Select<T extends string>({
  label,
  className,
  options,
}: {
  label: string;
  className?: string;
  options: { label: string; value: T }[];
}) {
  const field = useFieldContext<string>();
  return (
    <div className={cn("flex flex-col", className)}>
      <Label htmlFor={field.name}>{label}</Label>
      <UISelect
        value={field.state.value}
        onValueChange={field.handleChange}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </UISelect>
      <FieldErrors meta={field.state.meta} />
    </div>
  );
}
