import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { m } from "@gc/i18n/messages";
import { cn } from "@gc/utils";

import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export function ColorPicker<T extends string | undefined>({
  className,
  value,
  colors,
  onValueChange,
  placeholder,
}: {
  className?: string;
  value?: T;
  colors: readonly {
    value: T;
    label: string;
  }[];
  onValueChange: (value: T) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const selectedColor = value
    ? colors.find((color) => color.value === value)
    : null;

  const handleColorSelect = (colorValue: T) => {
    if (value === colorValue) {
      // Allow deselecting by clicking the same color
      onValueChange(undefined as T);
    } else {
      onValueChange(colorValue);
    }
    setOpen(false);
  };

  return (
    <Popover
      onOpenChange={setOpen}
      open={open}
    >
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className={cn("h-9 justify-between", className)}
          role="combobox"
          variant="outline"
        >
          <div className="flex items-center gap-2">
            {selectedColor ? (
              <>
                <div
                  className="border-border size-4 rounded-full border shadow-sm"
                  style={{ backgroundColor: selectedColor.value }}
                />
                <span>{selectedColor.label}</span>
              </>
            ) : (
              <span className="text-muted-foreground">
                {placeholder ?? m.select_placeholder()}
              </span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3">
        <div className="grid grid-cols-5 gap-2">
          {colors.map((color) => {
            const isSelected = value === color.value;
            return (
              <button
                key={color.value}
                type="button"
                onClick={() => handleColorSelect(color.value)}
                className={cn(
                  "group relative flex size-10 items-center justify-center rounded-full border-2 transition-all",
                  "hover:border-foreground/60 hover:scale-110 hover:shadow-md",
                  "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  isSelected
                    ? "border-foreground ring-ring shadow-lg ring-2 ring-offset-1"
                    : "hover:border-border/60 border-transparent"
                )}
                style={{ backgroundColor: color.value }}
                aria-label={color.label}
                aria-pressed={isSelected}
              >
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-black/20" />
                    <Check className="relative size-4 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
