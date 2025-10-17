import { useStore } from "@tanstack/react-form";

import { m } from "@gc/i18n/messages";
import { Label, TimePicker, DatePicker as UIDatePicker } from "@gc/ui";
import { cn } from "@gc/utils";

import type { FieldError } from "../types/field-error";
import { useFieldContext } from "../use-app-form";
import { FieldErrors } from "./field-errors";

const invalidDateError: FieldError = {
  code: "invalid date",
  message: m.form_field_date_invalid_date(),
  origin: "date-picker",
  path: ["date-picker"],
};

export function DatePickerField({
  label,
  className,
  initialInputValue,
  defaultTime,
}: {
  label: string;
  className?: string;
  initialInputValue?: string;
  defaultTime?: "end-of-day";
}) {
  const field = useFieldContext<Date>();

  const state = useStore(field.store, (state) => state);

  function handleInvalidDateError(error: boolean) {
    const origOnBlurErrorMap: FieldError[] =
      field.state.meta.errorMap.onBlur ?? [];
    if (error) {
      const invalidDateErrorExists = origOnBlurErrorMap.some(
        (error: FieldError) => error.code === "invalid date"
      );
      if (!invalidDateErrorExists) {
        field.setErrorMap({
          onBlur: [...origOnBlurErrorMap, invalidDateError],
        });
      }
    } else {
      field.setErrorMap({
        onBlur: origOnBlurErrorMap.filter(
          (error: FieldError) => error.code !== "invalid date"
        ),
      });
    }
  }
  return (
    <div className={cn("flex flex-col", className)}>
      <Label htmlFor={field.name}>{label}</Label>
      <div className="flex gap-2">
        <UIDatePicker
          value={state.value}
          onChange={field.handleChange}
          onBlur={field.handleBlur}
          onInvalidDateError={handleInvalidDateError}
          initialInputValue={initialInputValue}
          defaultTime={defaultTime}
        />
        <TimePicker
          value={state.value}
          onChange={field.handleChange}
          onBlur={field.handleBlur}
        />
      </div>
      <FieldErrors meta={state.meta} />
    </div>
  );
}
