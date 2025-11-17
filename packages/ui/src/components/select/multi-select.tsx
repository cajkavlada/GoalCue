import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { m } from "@gc/i18n/messages";
import { cn } from "@gc/utils";

import { Badge } from "../badge";
import { Button } from "../button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../command";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";

export function MultiSelect<T extends string>({
  className,
  options,
  value: selectedValues,
  onValueChange,
  placeholder,
  emptyMessage,
}: {
  className?: string;
  options: { label: string; value: T }[];
  value: T[];
  onValueChange: (value: T[]) => void;
  placeholder?: string;
  emptyMessage: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover
      onOpenChange={setOpen}
      open={open}
    >
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className={cn("h-fit justify-between", className)}
          role="combobox"
          variant="outline"
        >
          <div className="flex flex-wrap gap-1">
            {selectedValues.length > 0 ? (
              selectedValues.map((value) => (
                <Badge
                  className="mr-1"
                  key={value}
                  variant="secondary"
                >
                  {options.find((option) => option.value === value)?.label}
                  <span
                    role="button"
                    className="ring-offset-background focus:ring-ring ml-1 rounded-full outline-none focus:ring-2 focus:ring-offset-2"
                    onClick={() =>
                      onValueChange(selectedValues.filter((v) => v !== value))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onValueChange(
                          selectedValues.filter((v) => v !== value)
                        );
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <X className="text-muted-foreground hover:text-foreground size-3" />
                  </span>
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">
                {placeholder ?? m.select_placeholder()}
              </span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder={m.search_placeholder()} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  onSelect={(currentValue) => {
                    onValueChange(
                      selectedValues.includes(currentValue as T)
                        ? selectedValues.filter((v) => v !== currentValue)
                        : [...selectedValues, currentValue as T]
                    );
                  }}
                  value={option.value}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      selectedValues.includes(option.value)
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
