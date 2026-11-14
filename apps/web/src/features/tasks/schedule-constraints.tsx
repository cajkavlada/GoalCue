import { useState } from "react";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { format } from "date-fns";

import { api } from "@gc/convex/api";
import { Doc } from "@gc/convex/types";
import { m } from "@gc/i18n/messages";
import {
  Button,
  Checkbox,
  DatePicker,
  Drawer,
  Input,
  parseDateToString,
  Select,
  TimePicker,
  useModal,
} from "@gc/ui";
import {
  eventsCompatible,
  localDateTime,
  overlaps,
  PlanningSettings,
  TimeWindow,
  WeeklyWindow,
  zonedInstant,
} from "@gc/validators";

const timeText = (minute: number) =>
  `${String(Math.floor(minute / 60) % 24).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
const timeValue = (value: string) =>
  Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

function Windows({
  windows,
  onChange,
  weekly = false,
}: {
  windows: WeeklyWindow[] | TimeWindow[];
  onChange: (windows: WeeklyWindow[]) => void;
  weekly?: boolean;
}) {
  return (
    <div className="space-y-2">
      {windows.map((window, index) => (
        <div
          key={index}
          className="flex flex-wrap gap-2"
        >
          {weekly && (
            <label className="min-w-32 flex-1">
              <span className="sr-only">{m.constraints_weekday()}</span>
              <Select
                value={String("weekday" in window ? window.weekday : 1)}
                onValueChange={(value) =>
                  onChange(
                    windows.map((w, i) => ({
                      weekday: 1,
                      ...w,
                      ...(i === index ? { weekday: Number(value) } : {}),
                    }))
                  )
                }
                options={[
                  m.constraints_sunday(),
                  m.constraints_monday(),
                  m.constraints_tuesday(),
                  m.constraints_wednesday(),
                  m.constraints_thursday(),
                  m.constraints_friday(),
                  m.constraints_saturday(),
                ].map((label, value) => ({ label, value: String(value) }))}
              />
            </label>
          )}
          <PlanningTimePicker
            label={m.planning_start()}
            value={timeText(window.start)}
            onChange={(value) => {
              onChange(
                windows.map((w, i) => ({
                  weekday: 1,
                  ...w,
                  ...(i === index ? { start: timeValue(value) } : {}),
                }))
              );
            }}
          />
          <PlanningTimePicker
            label={m.constraints_end()}
            value={timeText(window.end)}
            onChange={(value) => {
              onChange(
                windows.map((w, i) => ({
                  weekday: 1,
                  ...w,
                  ...(i === index ? { end: timeValue(value) || 1440 } : {}),
                }))
              );
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onChange(
                windows
                  .filter((_, i) => i !== index)
                  .map((w) => ({ weekday: 1, ...w }))
              )
            }
          >
            {m.constraints_remove()}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange([
            ...windows.map((w) => ({ weekday: 1, ...w })),
            { weekday: 1, start: 540, end: 1020 },
          ])
        }
      >
        {m.constraints_add_window()}
      </Button>
    </div>
  );
}

export function PlanningTimeSettings() {
  const { data: saved } = useSuspenseQuery(
    convexQuery(api.planning.getSettings, {})
  );
  const [settings, setSettings] = useState<PlanningSettings>(
    () =>
      saved ?? {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        weekly: [],
        restrictAvailability: false,
        overrides: [],
        protectedWeekly: [],
        protectedDates: [],
      }
  );
  const [date, setDate] = useState(() =>
    localDateTime(Date.now(), settings.timezone).slice(0, 10)
  );
  const save = useMutation({
    mutationFn: useConvexMutation(api.planning.saveSettings),
  });
  return (
    <form
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({
          timezone: settings.timezone,
          restrictAvailability:
            settings.restrictAvailability ?? settings.weekly.length > 0,
          weekly: settings.weekly,
          protectedWeekly: settings.protectedWeekly,
          overrides: settings.overrides,
          protectedDates: settings.protectedDates,
        });
      }}
    >
      <label>
        {m.constraints_timezone()}
        <Input
          required
          value={settings.timezone}
          onChange={(e) =>
            setSettings({ ...settings, timezone: e.target.value })
          }
        />
      </label>
      <p className="text-muted-foreground text-sm">
        {m.constraints_default_hint()}
      </p>
      <h3>{m.constraints_protected()}</h3>
      <Windows
        weekly
        windows={settings.protectedWeekly}
        onChange={(protectedWeekly) =>
          setSettings({ ...settings, protectedWeekly })
        }
      />
      <p className="text-muted-foreground text-xs">
        {m.constraints_protected_hint()}
      </p>
      <label>
        {m.planning_date()}
        <PlanningDatePicker
          value={date}
          onChange={setDate}
        />
      </label>
      <h3>{m.constraints_protected_dates()}</h3>
      {settings.protectedDates.map((period, index) => (
        <fieldset
          key={index}
          className="space-y-2 rounded border p-2"
        >
          <PlanningDatePicker
            value={period.date}
            onChange={(date) =>
              setSettings({
                ...settings,
                protectedDates: settings.protectedDates.map((p, i) =>
                  i === index ? { ...p, date: date } : p
                ),
              })
            }
          />
          <Windows
            windows={[period]}
            onChange={(windows) =>
              setSettings({
                ...settings,
                protectedDates: settings.protectedDates.flatMap((p, i) =>
                  i === index
                    ? windows.map(({ start, end }) => ({
                        date: p.date,
                        start,
                        end,
                      }))
                    : [p]
                ),
              })
            }
          />
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          setSettings({
            ...settings,
            protectedDates: [
              ...settings.protectedDates,
              { date, start: 720, end: 780 },
            ],
          })
        }
      >
        {m.constraints_add_protected()}
      </Button>
      <details className="space-y-4 rounded border p-3">
        <summary className="cursor-pointer font-medium">
          {m.constraints_optional_limits()}
        </summary>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={
              settings.restrictAvailability ?? settings.weekly.length > 0
            }
            onCheckedChange={(checked) =>
              setSettings({
                ...settings,
                restrictAvailability: checked === true,
              })
            }
          />
          {m.constraints_use_weekly()}
        </label>
        {(settings.restrictAvailability ?? settings.weekly.length > 0) && (
          <Windows
            weekly
            windows={settings.weekly}
            onChange={(weekly) => setSettings({ ...settings, weekly })}
          />
        )}
        <p className="text-muted-foreground text-xs">
          {m.constraints_window_hint()}
        </p>
        <h3>{m.constraints_overrides()}</h3>
        <p className="text-muted-foreground text-xs">
          {m.constraints_override_hint()}
        </p>
        {settings.overrides.map((override, index) => (
          <fieldset
            key={index}
            className="space-y-2 rounded border p-2"
          >
            <PlanningDatePicker
              value={override.date}
              onChange={(date) =>
                setSettings({
                  ...settings,
                  overrides: settings.overrides.map((o, i) =>
                    i === index ? { ...o, date: date } : o
                  ),
                })
              }
            />
            <label className="block space-y-1 text-sm">
              {m.constraints_override_mode()}
              <Select
                value={override.mode}
                onValueChange={(mode) =>
                  setSettings({
                    ...settings,
                    overrides: settings.overrides.map((o, i) =>
                      i === index ? { ...o, mode } : o
                    ),
                  })
                }
                options={[
                  { value: "add", label: m.constraints_add() },
                  { value: "remove", label: m.constraints_remove() },
                  { value: "replace", label: m.constraints_replace() },
                  { value: "close", label: m.constraints_close() },
                ]}
              />
            </label>
            {override.mode !== "close" && (
              <Windows
                windows={override.windows}
                onChange={(windows) =>
                  setSettings({
                    ...settings,
                    overrides: settings.overrides.map((o, i) =>
                      i === index
                        ? {
                            ...o,
                            windows: windows.map(({ start, end }) => ({
                              start,
                              end,
                            })),
                          }
                        : o
                    ),
                  })
                }
              />
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setSettings({
                  ...settings,
                  overrides: settings.overrides.filter((_, i) => i !== index),
                })
              }
            >
              {m.constraints_remove()}
            </Button>
          </fieldset>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setSettings({
              ...settings,
              overrides: [
                ...settings.overrides,
                { date, mode: "replace", windows: [{ start: 540, end: 1020 }] },
              ],
            })
          }
        >
          {m.constraints_add_override()}
        </Button>
      </details>
      {save.isSuccess && <p role="status">{m.planning_saved()}</p>}
      {save.isError && (
        <p role="alert">
          {save.error instanceof Error
            ? save.error.message
            : m.planning_save_failed()}
        </p>
      )}
      <Button
        disabled={save.isPending}
        type="submit"
      >
        {m.save()}
      </Button>
    </form>
  );
}

export function PlanningDatePicker({
  value,
  onChange,
  label = m.planning_date(),
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const date = new Date(`${value}T12:00`);
  return (
    <DatePicker
      required
      aria-label={label}
      value={date}
      initialInputValue={parseDateToString(date, "full")}
      onChange={(selected) => onChange(format(selected, "yyyy-MM-dd"))}
      onBlur={() => {}}
      onInvalidDateError={() => {}}
    />
  );
}

export function PlanningTimePicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <TimePicker
      required
      step={60}
      className="w-28"
      aria-label={label}
      value={new Date(`2000-01-01T${value}`)}
      onChange={(selected) => onChange(format(selected, "HH:mm"))}
      onBlur={() => {}}
    />
  );
}

function EventDateTime({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex gap-2">
        <PlanningDatePicker
          label={`${label}: ${m.planning_date()}`}
          value={value.slice(0, 10)}
          onChange={(date) => onChange(`${date}T${value.slice(11)}`)}
        />
        <PlanningTimePicker
          label={label}
          value={value.slice(11)}
          onChange={(time) => onChange(`${value.slice(0, 10)}T${time}`)}
        />
      </div>
    </fieldset>
  );
}

export function EventDetails({
  day,
  timezone,
  event,
}: {
  day: string;
  timezone: string;
  event?: Doc<"fixedEvents">;
}) {
  const { data: events } = useSuspenseQuery(
    convexQuery(api.planning.listEvents, {})
  );
  const { data: sessions } = useSuspenseQuery(
    convexQuery(api.sessions.listSessions, {})
  );
  const [title, setTitle] = useState(event?.title ?? "");
  const [zone, setZone] = useState(event?.timezone ?? timezone);
  const [start, setStart] = useState(
    event ? localDateTime(event.startAt, event.timezone) : `${day}T09:00`
  );
  const [end, setEnd] = useState(
    event ? localDateTime(event.endAt, event.timezone) : `${day}T10:00`
  );
  const [startRepeated, setStartRepeated] = useState<"earlier" | "later">(
    event &&
      zonedInstant(
        localDateTime(event.startAt, event.timezone),
        event.timezone
      ) !== event.startAt
      ? "later"
      : "earlier"
  );
  const [endRepeated, setEndRepeated] = useState<"earlier" | "later">(
    event &&
      zonedInstant(
        localDateTime(event.endAt, event.timezone),
        event.timezone
      ) !== event.endAt
      ? "later"
      : "earlier"
  );
  const [attention, setAttention] = useState<"focused" | "background">(
    event?.attention ?? "focused"
  );
  const [confirmed, setConfirmed] = useState(false);
  const { closeDrawer } = useModal();
  const save = useMutation({
    mutationFn: useConvexMutation(api.planning.saveEvent),
    onSuccess: () => closeDrawer(),
  });
  const remove = useMutation({
    mutationFn: useConvexMutation(api.planning.deleteEvent),
    onSuccess: () => closeDrawer(),
  });
  let error = "";
  let startAt = NaN;
  let endAt = NaN;
  let startChoices: number[] = [];
  let endChoices: number[] = [];
  try {
    startChoices = [
      zonedInstant(start, zone, "earlier"),
      zonedInstant(start, zone, "later"),
    ];
    endChoices = [
      zonedInstant(end, zone, "earlier"),
      zonedInstant(end, zone, "later"),
    ];
    startAt = zonedInstant(start, zone, startRepeated);
    endAt = zonedInstant(end, zone, endRepeated);
    if (endAt <= startAt) error = m.constraints_invalid_end();
  } catch (cause) {
    error = cause instanceof Error ? cause.message : m.planning_save_failed();
  }
  const draft = {
    title,
    startAt,
    endAt,
    timezone: zone,
    attention,
  };
  const conflicts = events
    .filter(
      (other) =>
        other._id !== event?._id &&
        overlaps(other, draft) &&
        !eventsCompatible(draft, other)
    )
    .map((other) => other.title);
  for (const session of sessions.filter((s) => overlaps(s, draft)))
    if (attention === "focused") conflicts.push(session.taskTitle);
  return (
    <form
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
      onSubmit={(e) => {
        e.preventDefault();
        if (!error && (!conflicts.length || confirmed))
          save.mutate({ ...draft, eventId: event?._id });
      }}
    >
      <label>
        {m.constraints_title()}
        <Input
          required
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setConfirmed(false);
          }}
        />
      </label>
      <label>
        {m.constraints_timezone()}
        <Input
          required
          value={zone}
          onChange={(e) => {
            setZone(e.target.value);
            setConfirmed(false);
          }}
        />
      </label>
      <EventDateTime
        label={m.planning_start()}
        value={start}
        onChange={(value) => {
          setStart(value);
          setConfirmed(false);
        }}
      />
      {startChoices.length === 2 && startChoices[0] !== startChoices[1] && (
        <label>
          {m.constraints_ambiguous_start()}
          <Select
            value={startRepeated}
            onValueChange={(value) => {
              setStartRepeated(value);
              setConfirmed(false);
            }}
            options={startChoices.map((instant, index) => ({
              value: index === 0 ? ("earlier" as const) : ("later" as const),
              label: new Intl.DateTimeFormat(undefined, {
                timeZone: zone,
                hour: "2-digit",
                minute: "2-digit",
                timeZoneName: "shortOffset",
                hourCycle: "h23",
              }).format(instant),
            }))}
          />
          <span className="text-muted-foreground block text-xs">
            {m.constraints_ambiguous_hint()}
          </span>
        </label>
      )}
      <EventDateTime
        label={m.constraints_end()}
        value={end}
        onChange={(value) => {
          setEnd(value);
          setConfirmed(false);
        }}
      />
      {endChoices.length === 2 && endChoices[0] !== endChoices[1] && (
        <label>
          {m.constraints_ambiguous_end()}
          <Select
            value={endRepeated}
            onValueChange={(value) => {
              setEndRepeated(value);
              setConfirmed(false);
            }}
            options={endChoices.map((instant, index) => ({
              value: index === 0 ? ("earlier" as const) : ("later" as const),
              label: new Intl.DateTimeFormat(undefined, {
                timeZone: zone,
                hour: "2-digit",
                minute: "2-digit",
                timeZoneName: "shortOffset",
                hourCycle: "h23",
              }).format(instant),
            }))}
          />
          <span className="text-muted-foreground block text-xs">
            {m.constraints_ambiguous_hint()}
          </span>
        </label>
      )}
      <label>
        {m.constraints_attention()}
        <Select
          value={attention}
          onValueChange={(value) => {
            setAttention(value);
            setConfirmed(false);
          }}
          options={[
            { value: "focused", label: m.constraints_focused() },
            { value: "background", label: m.constraints_background() },
          ]}
        />
      </label>
      <p className="text-muted-foreground text-xs">
        {m.constraints_attention_hint()}
      </p>
      {!!conflicts.length && (
        <div role="alert">
          {m.constraints_conflicts()}: {conflicts.join(", ")}
        </div>
      )}
      {!!conflicts.length && (
        <label>
          <Checkbox
            checked={confirmed}
            onCheckedChange={(checked) => setConfirmed(checked === true)}
          />{" "}
          {m.constraints_keep_event()}
        </label>
      )}
      {(error || save.isError || remove.isError) && (
        <p role="alert">{error || m.planning_save_failed()}</p>
      )}
      {event && (
        <Button
          type="button"
          variant="outline"
          disabled={remove.isPending || save.isPending}
          onClick={() => remove.mutate({ eventId: event._id })}
        >
          {m.constraints_delete_event()}
        </Button>
      )}
      <Drawer.Footer>
        <Button
          type="submit"
          disabled={
            !!error ||
            !title.trim() ||
            save.isPending ||
            remove.isPending ||
            (!!conflicts.length && !confirmed)
          }
        >
          {m.save()}
        </Button>
      </Drawer.Footer>
    </form>
  );
}
