import type { CreateTaskArgs } from "./schemas/task.val";
import { dayBounds, shiftDate, zonedInstant } from "./planning";

export type RecurrenceRule = NonNullable<CreateTaskArgs["recurrence"]>;

export function validateRecurrence(rule: RecurrenceRule) {
  if (
    rule.weekdays &&
    (rule.kind !== "calendar" ||
      rule.unit !== "day" ||
      !rule.weekdays.length ||
      rule.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))
  )
    throw new Error("Choose valid weekdays for a daily calendar recurrence");
  if (rule.endDate && rule.endAfter !== undefined)
    throw new Error("Choose either an end date or an Occurrence count");
  const date = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (
    !date(rule.startDate) ||
    (rule.endDate && (!date(rule.endDate) || rule.endDate < rule.startDate))
  )
    throw new Error(
      "Choose valid recurrence dates, with the end after the start"
    );
  for (const [value, max] of [
    [rule.interval, 365],
    [rule.count, 31],
    [rule.weekStartsOn + 1, 7],
    [rule.endAfter ?? 1, 10000],
  ])
    if (!Number.isInteger(value) || value! < 1 || value! > max!)
      throw new Error(
        "Choose positive recurrence intervals, counts, and a valid week start"
      );
  if (!Number.isFinite(rule.volume) || rule.volume <= 0)
    throw new Error("Choose a positive volume target");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(rule.time))
    throw new Error("Choose a valid local recurrence time");
  zonedInstant(
    `${rule.startDate}T${rule.time}`,
    rule.timezone,
    "earlier",
    "forward"
  );
}

export function recurrenceDate(
  start: string,
  unit: RecurrenceRule["unit"],
  amount: number
) {
  if (unit === "day" || unit === "week")
    return shiftDate(start, amount * (unit === "week" ? 7 : 1));
  const source = new Date(`${start}T12:00Z`);
  const target = new Date(
    Date.UTC(
      source.getUTCFullYear(),
      source.getUTCMonth() + amount * (unit === "year" ? 12 : 1),
      1,
      12
    )
  );
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(source.getUTCDate(), last));
  return target.toISOString().slice(0, 10);
}

export function recurrenceWindows(
  rule: RecurrenceRule,
  from: string,
  through: string
) {
  validateRecurrence(rule);
  let anchor = rule.startDate;
  if (
    (rule.kind === "frequency" || rule.kind === "volume") &&
    rule.unit === "week"
  ) {
    const weekday = new Date(`${anchor}T12:00Z`).getUTCDay();
    anchor = shiftDate(anchor, -((weekday - rule.weekStartsOn + 7) % 7));
  }
  const months = (date: string) =>
    Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
  const difference =
    rule.unit === "month" || rule.unit === "year"
      ? (months(from) - months(anchor)) / (rule.unit === "year" ? 12 : 1)
      : (Date.parse(from) - Date.parse(anchor)) /
        (86400000 * (rule.unit === "week" ? 7 : 1));
  const first = Math.max(0, Math.floor(difference / rule.interval) - 1);
  const result: {
    key: string;
    startAt: number;
    endAt: number;
    date: string;
  }[] = [];
  for (let index = first; ; index++) {
    const date = recurrenceDate(anchor, rule.unit, index * rule.interval);
    if (date > through || (rule.endDate && date > rule.endDate)) break;
    if (
      rule.weekdays &&
      !rule.weekdays.includes(new Date(`${date}T12:00Z`).getUTCDay())
    )
      continue;
    const next = recurrenceDate(anchor, rule.unit, (index + 1) * rule.interval);
    const count = rule.kind === "frequency" ? rule.count : 1;
    const startWeekday = new Date(`${anchor}T12:00Z`).getUTCDay();
    const selectedBefore = (length: number) =>
      Array.from({ length }, (_, offset) =>
        Number(
          rule.weekdays!.includes((startWeekday + offset * rule.interval) % 7)
        )
      ).reduce((a, b) => a + b, 0);
    const ordinal = rule.weekdays
      ? Math.floor(index / 7) * selectedBefore(7) + selectedBefore(index % 7)
      : index;
    if (next <= from) continue;
    for (let slot = 0; slot < count; slot++) {
      if (
        rule.endAfter !== undefined &&
        ordinal * count + slot >= rule.endAfter
      )
        return result;
      const start = date < rule.startDate ? rule.startDate : date;
      const end =
        rule.endDate && rule.endDate < next ? shiftDate(rule.endDate, 1) : next;
      result.push({
        key: `${index}:${slot}`,
        date: start,
        startAt: zonedInstant(
          `${start}T${rule.time}`,
          rule.timezone,
          "earlier",
          "forward"
        ),
        endAt: dayBounds(end, rule.timezone).startAt,
      });
    }
  }
  return result;
}
