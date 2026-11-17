import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { Id } from "@gc/convex/types";
import { m } from "@gc/i18n/messages";
import { Input, Select, Switch } from "@gc/ui";
import { localDateTime, RecurrenceRule } from "@gc/validators";

import { translatePregeneratedItem } from "../../utils/translate-pregenerated-items";
import { PlanningDatePicker, PlanningTimePicker } from "./schedule-constraints";

export function RecurrenceEditor({
  value,
  onChange,
  timezone,
  weekStartsOn = 1,
  progressMeasure,
  progressUnit,
  unitId,
  disabled = false,
}: {
  value: RecurrenceRule | undefined;
  onChange: (value: RecurrenceRule | undefined) => void;
  timezone: string;
  weekStartsOn?: number;
  progressMeasure?: "done" | "time" | "percentage" | "quantity";
  progressUnit?: string;
  unitId?: Id<"units">;
  disabled?: boolean;
}) {
  const { data: units } = useSuspenseQuery(convexQuery(api.units.list, {}));
  const unit = units.find((unit) => unit._id === unitId);
  const volumeUnit =
    progressMeasure === "time"
      ? m.planning_minutes()
      : progressMeasure === "percentage"
        ? "%"
        : progressMeasure === "quantity"
          ? progressUnit?.trim() ||
            (unit
              ? translatePregeneratedItem(unit).name
              : m.planning_quantity())
          : unit
            ? translatePregeneratedItem(unit).name
            : m.planning_quantity();
  const update = (patch: Partial<RecurrenceRule>) => {
    const next = { ...value!, ...patch };
    if (next.kind !== "calendar" || next.unit !== "day")
      next.weekdays = undefined;
    onChange(next);
  };
  const ending = value?.endDate
    ? "date"
    : value?.endAfter !== undefined
      ? "count"
      : "never";
  return (
    <fieldset
      disabled={disabled}
      className="space-y-3 rounded-lg border p-3"
    >
      <legend>{m.recurrence_title()}</legend>
      <label className="flex items-center gap-2">
        <Switch
          checked={!!value}
          disabled={disabled}
          onCheckedChange={(checked) =>
            onChange(
              checked
                ? {
                    kind: "calendar",
                    unit: "week",
                    interval: 1,
                    startDate: localDateTime(Date.now(), timezone).slice(0, 10),
                    time: "09:00",
                    timezone,
                    weekStartsOn,
                    count: 3,
                    volume: 150,
                    carryForward: false,
                  }
                : undefined
            )
          }
        />
        {m.recurrence_enable()}
      </label>
      {value && (
        <>
          {value.kind === "calendar" && value.unit === "day" && (
            <fieldset className="space-y-2">
              <legend>{m.mail_weekdays()}</legend>
              {[
                m.constraints_sunday(),
                m.constraints_monday(),
                m.constraints_tuesday(),
                m.constraints_wednesday(),
                m.constraints_thursday(),
                m.constraints_friday(),
                m.constraints_saturday(),
              ].map((label, day) => (
                <label
                  key={day}
                  className="flex items-center gap-2"
                >
                  <Switch
                    checked={!value.weekdays || value.weekdays.includes(day)}
                    onCheckedChange={(checked) => {
                      const days = value.weekdays ?? [0, 1, 2, 3, 4, 5, 6];
                      const next = checked
                        ? [...days, day]
                        : days.filter((d) => d !== day);
                      if (next.length) update({ weekdays: next });
                    }}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          )}
          <label className="block">
            {m.recurrence_kind()}
            <Select
              value={value.kind}
              onValueChange={(kind) => update({ kind })}
              options={[
                {
                  value: "calendar",
                  label: m.recurrence_calendar(),
                  description: m.recurrence_calendar_example(),
                },
                {
                  value: "frequency",
                  label: m.recurrence_frequency(),
                  description: m.recurrence_frequency_example(),
                },
                {
                  value: "volume",
                  label: m.recurrence_volume(),
                  description: m.recurrence_volume_example(),
                },
                {
                  value: "completion",
                  label: m.recurrence_completion(),
                  description: m.recurrence_completion_example(),
                },
              ]}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              {m.recurrence_interval()}
              <Input
                type="number"
                required
                min="1"
                max="365"
                value={value.interval}
                onChange={(e) => update({ interval: Number(e.target.value) })}
              />
            </label>
            <label>
              {m.recurrence_period()}
              <Select
                value={value.unit}
                onValueChange={(unit) => update({ unit })}
                options={[
                  { value: "day", label: m.recurrence_day() },
                  { value: "week", label: m.recurrence_week() },
                  { value: "month", label: m.recurrence_month() },
                  { value: "year", label: m.recurrence_year() },
                ]}
              />
            </label>
            <label className="min-w-0">
              {m.recurrence_start()}
              <PlanningDatePicker
                label={m.recurrence_start()}
                value={value.startDate}
                onChange={(startDate) => update({ startDate })}
              />
            </label>
            <label>
              {m.recurrence_time()}
              <PlanningTimePicker
                label={m.recurrence_time()}
                value={value.time}
                onChange={(time) => update({ time })}
              />
            </label>
          </div>
          {value.kind === "frequency" && (
            <label className="block">
              {m.recurrence_count()}
              <Input
                type="number"
                required
                min="1"
                max="31"
                value={value.count}
                onChange={(e) => update({ count: Number(e.target.value) })}
              />
            </label>
          )}
          {value.kind === "volume" && (
            <label className="block">
              {m.recurrence_target({ unit: volumeUnit })}
              <Input
                type="number"
                required
                min="0.01"
                step="any"
                value={value.volume}
                onChange={(e) => update({ volume: Number(e.target.value) })}
              />
            </label>
          )}
          <div className="grid grid-cols-2 items-end gap-3">
            <label className="min-w-0">
              {m.recurrence_ending()}
              <Select
                value={ending}
                onValueChange={(end) =>
                  update({
                    endDate:
                      end === "date"
                        ? (value.endDate ?? value.startDate)
                        : undefined,
                    endAfter:
                      end === "count" ? (value.endAfter ?? 10) : undefined,
                  })
                }
                options={[
                  { value: "never", label: m.recurrence_no_end() },
                  { value: "date", label: m.recurrence_on_date() },
                  { value: "count", label: m.recurrence_after_count() },
                ]}
              />
            </label>
            {ending === "date" && (
              <label className="min-w-0">
                {m.recurrence_end()}
                <PlanningDatePicker
                  label={m.recurrence_end()}
                  value={value.endDate!}
                  onChange={(endDate) => update({ endDate })}
                />
              </label>
            )}
            {ending === "count" && (
              <label className="min-w-0">
                {m.recurrence_end_after()}
                <Input
                  type="number"
                  required
                  min="1"
                  max="10000"
                  value={value.endAfter}
                  onChange={(e) => update({ endAfter: Number(e.target.value) })}
                />
              </label>
            )}
          </div>
          {ending === "never" && (
            <p className="text-muted-foreground text-xs">
              {m.recurrence_no_end_hint()}
            </p>
          )}
          {value.kind !== "completion" && (
            <label className="flex items-center gap-2">
              <Switch
                disabled={disabled}
                checked={value.carryForward}
                onCheckedChange={(carryForward) => update({ carryForward })}
              />
              {m.recurrence_carry()}
            </label>
          )}
          <p className="text-muted-foreground text-xs">
            {m.recurrence_explanation()}
          </p>
        </>
      )}
    </fieldset>
  );
}
