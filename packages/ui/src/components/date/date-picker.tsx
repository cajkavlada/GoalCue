import { useEffect, useId, useRef, useState } from "react";
import { CalendarIcon } from "lucide-react";

import { m } from "@gc/i18n/messages";
import { getLocale } from "@gc/i18n/runtime";

import { Button } from "../button";
import { InputGroup, InputGroupInput } from "../input";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { Calendar } from "./calendar";
import { dateFnsLocales } from "./date-locale";
import { parseDateToString, parseStringToDate } from "./date-parser";

export function DatePicker({
  value,
  onChange,
  initialInputValue,
  defaultTime,
  onBlur,
  onInvalidDateError,
  required,
  "aria-label": ariaLabel,
}: {
  value: Date;
  onChange: (date: Date) => void;
  initialInputValue?: string;
  defaultTime?: "end-of-day";
  onBlur: () => void;
  onInvalidDateError: (error: boolean) => void;
  required?: boolean;
  "aria-label"?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const focused = useRef(false);
  const previousValue = useRef(value.getTime());
  const [inputValue, setInputValue] = useState(initialInputValue ?? "");

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<Date>(value);

  const [error, setError] = useState<boolean>(false);

  const locale = getLocale();
  useEffect(() => {
    if (previousValue.current !== value.getTime()) {
      previousValue.current = value.getTime();
      if (!focused.current) {
        setInputValue(parseDateToString(value, "full"));
        setSelectedMonth(value);
        setError(false);
        input.current?.setCustomValidity("");
      }
    }
  }, [value]);

  function setDateOnly(originalDate: Date, refDate: Date) {
    const newDate = new Date(originalDate);
    newDate.setFullYear(
      refDate.getFullYear(),
      refDate.getMonth(),
      refDate.getDate()
    );
    onChange(newDate);
  }

  function handleInputChange(newInputValue: string) {
    setInputValue(newInputValue);
    const date = parseStringToDate(newInputValue, defaultTime);
    if (date) {
      setDateOnly(value, date);
      setSelectedMonth(date);
      setError(false);
      input.current?.setCustomValidity("");
    } else {
      setError(true);
      input.current?.setCustomValidity(m.form_field_date_invalid_date());
    }
  }

  function handleCalendarSelect(newDate: Date) {
    setDateOnly(value, newDate);
    setInputValue(parseDateToString(newDate, "full"));
    setCalendarOpen(false);
    setError(false);
    input.current?.setCustomValidity("");
    onInvalidDateError(false);
    onBlur();
  }

  function handleBlur() {
    focused.current = false;
    onInvalidDateError(error);
    onBlur();
  }

  return (
    <InputGroup>
      <InputGroupInput
        ref={input}
        id={id}
        required={required}
        aria-label={ariaLabel}
        aria-invalid={error}
        value={inputValue}
        className="bg-background pr-10"
        onChange={(e) => handleInputChange(e.target.value)}
        onBlur={handleBlur}
        onFocus={() => {
          focused.current = true;
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setCalendarOpen(true);
          }
        }}
      />
      <Popover
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="absolute right-2 top-1/2 size-6 -translate-y-1/2"
          >
            <CalendarIcon className="size-3.5" />
            <span className="sr-only">{m.form_field_date_placeholder()}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0">
          <Calendar
            required
            locale={dateFnsLocales[locale]}
            mode="single"
            selected={value}
            captionLayout="dropdown"
            month={selectedMonth}
            endMonth={
              new Date(
                Math.max(
                  new Date().getFullYear(),
                  selectedMonth.getFullYear()
                ) + 10,
                11,
                31
              )
            }
            formatters={{
              formatMonthDropdown: (month) => parseDateToString(month),
            }}
            onMonthChange={setSelectedMonth}
            onSelect={handleCalendarSelect}
          />
        </PopoverContent>
      </Popover>
    </InputGroup>
  );
}
