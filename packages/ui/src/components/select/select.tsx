import { m } from "@gc/i18n/messages";
import { cn } from "@gc/utils";

import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Select as UISelect,
} from "./select-primitives";

export function Select<T extends string>({
  className,
  options,
  value,
  onValueChange,
  children,
  placeholder,
}: {
  className?: string;
  options?: { label: string; value: T }[];
  value: T;
  onValueChange: (value: T) => void;
  children?: React.ReactNode;
  placeholder?: string;
}) {
  return (
    <UISelect
      value={value}
      onValueChange={onValueChange}
    >
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue
          placeholder={
            placeholder ?? options?.[0]?.label ?? m.select_placeholder()
          }
        />
      </SelectTrigger>
      <SelectContent>
        {options?.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
          >
            {option.label}
          </SelectItem>
        ))}
        {children}
      </SelectContent>
    </UISelect>
  );
}

export { SelectItem };
