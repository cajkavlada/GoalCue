import { useId } from "react";

import { cn } from "@gc/utils";

import { Input } from "../input";

export function TimePicker({
  value,
  onChange,
  onBlur,
  step = 1,
  required,
  className,
  "aria-label": ariaLabel,
}: {
  value: Date;
  onChange: (date: Date) => void;
  onBlur: () => void;
  step?: number;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const id = useId();
  function handleChange(newValue: string) {
    const newDate = new Date(value);
    const [hours, minutes, seconds] = newValue.split(":");
    newDate.setHours(
      parseInt(hours ?? "0"),
      parseInt(minutes ?? "0"),
      parseInt(seconds ?? "0")
    );
    onChange(newDate);
  }
  return (
    <Input
      type="time"
      id={id}
      step={step}
      required={required}
      aria-label={ariaLabel}
      onBlur={onBlur}
      value={value.toTimeString().slice(0, step >= 60 ? 5 : 8)}
      onChange={(e) => {
        if (e.target.value) handleChange(e.target.value);
      }}
      className={cn(
        "bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
        className
      )}
    />
  );
}
