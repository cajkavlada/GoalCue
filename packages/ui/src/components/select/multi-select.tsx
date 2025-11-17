import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { m } from "@gc/i18n/messages";
import { cn, getTextColorForBg } from "@gc/utils";

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

export function MultiSelect<T extends string, C extends string | undefined>({
  className,
  options,
  value: selectedValues,
  onValueChange,
  placeholder,
  emptyMessage,
}: {
  className?: string;
  options: { label: string; value: T; color?: C }[];
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
              selectedValues.map((value) => {
                const option = options.find((option) => option.value === value);
                if (!option) return null;
                return (
                  <Badge
                    className="mr-1 rounded-full"
                    key={value}
                    variant="secondary"
                    style={{
                      backgroundColor: option.color,
                      color: getTextColorForBg(option.color),
                    }}
                  >
                    {option.label}
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
                      <X
                        className="text-muted-foreground hover:text-foreground size-3"
                        style={{ color: getTextColorForBg(option.color) }}
                      />
                    </span>
                  </Badge>
                );
              })
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
                  <div
                    className="border-border mr-2 size-4 rounded-full border shadow-sm"
                    style={{ backgroundColor: option.color }}
                  >
                    <Check
                      className={cn(
                        selectedValues.includes(option.value)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                      style={{ color: getTextColorForBg(option.color) }}
                    />
                  </div>
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
