import { useState } from "react";
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
}: {
  value: Date;
  onChange: (date: Date) => void;
  initialInputValue?: string;
  defaultTime?: "end-of-day";
  onBlur: () => void;
  onInvalidDateError: (error: boolean) => void;
}) {
  const [inputValue, setInputValue] = useState(initialInputValue ?? "");

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<Date>(value);

  const [error, setError] = useState<boolean>(false);

  const locale = getLocale();

  function setDateOnly(originalDate: Date, refDate: Date) {
    const newDate = new Date(originalDate);
    newDate.setFullYear(refDate.getFullYear());
    newDate.setMonth(refDate.getMonth());
    newDate.setDate(refDate.getDate());
    onChange(newDate);
  }

  function handleInputChange(newInputValue: string) {
    setInputValue(newInputValue);
    const date = parseStringToDate(newInputValue, defaultTime);
    if (date) {
      setDateOnly(value, date);
      setSelectedMonth(date);
      setError(false);
    } else {
      setError(true);
    }
  }

  function handleCalendarSelect(newDate: Date) {
    setDateOnly(value, newDate);
    setInputValue(parseDateToString(newDate, "full"));
    setCalendarOpen(false);
    setError(false);
    onInvalidDateError(false);
    onBlur();
  }

  function handleBlur() {
    onInvalidDateError(error);
    onBlur();
  }

  return (
    <InputGroup>
      <InputGroupInput
        id="date-picker "
        value={inputValue}
        className="bg-background pr-10"
        onChange={(e) => handleInputChange(e.target.value)}
        onBlur={handleBlur}
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
            id="date-picker"
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
