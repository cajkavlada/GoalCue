export type TimeWindow = { start: number; end: number };
export type WeeklyWindow = TimeWindow & { weekday: number };
export type DateOverride = {
  date: string;
  mode: "add" | "remove" | "replace" | "close";
  windows: TimeWindow[];
};
export type PlanningSettings = {
  timezone: string;
  restrictAvailability?: boolean;
  weekly: WeeklyWindow[];
  overrides: DateOverride[];
  protectedWeekly: WeeklyWindow[];
  protectedDates: (TimeWindow & { date: string })[];
};
export type Interval = { startAt: number; endAt: number };
export function supportsBatchCheckIn(
  session: {
    startAt: number;
    checkIn?: unknown;
    checkInRequestedAt?: number;
    unscheduledAt?: number;
    taskCompletedAt?: number;
    taskArchivedAt?: number;
  },
  now: number
) {
  return (
    session.checkIn === undefined &&
    session.unscheduledAt === undefined &&
    session.taskCompletedAt === undefined &&
    session.taskArchivedAt === undefined &&
    (session.startAt <= now || session.checkInRequestedAt !== undefined)
  );
}
export type FixedEvent = Interval & {
  title: string;
  attention: "focused" | "background";
};

export function localDateTime(instant: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function shiftDate(date: string, days: number) {
  return new Date(Date.parse(`${date}T12:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}

export function zonedInstant(
  local: string,
  timezone: string,
  repeated: "earlier" | "later" = "earlier",
  gap: "reject" | "forward" = "reject"
) {
  const naive = Date.parse(`${local}Z`);
  if (
    !Number.isFinite(naive) ||
    new Date(naive).toISOString().slice(0, 16) !== local
  )
    throw new Error("Enter a valid date and time");
  const offsets = new Set<number>();
  for (const hours of [-36, -12, 0, 12, 36]) {
    const sample = naive + hours * 3600000;
    offsets.add(Date.parse(`${localDateTime(sample, timezone)}Z`) - sample);
  }
  const candidates = [...offsets]
    .map((offset) => naive - offset)
    .sort((a, b) => a - b);
  const exact = candidates.filter(
    (instant) => localDateTime(instant, timezone) === local
  );
  if (exact.length)
    return repeated === "later" ? exact[exact.length - 1]! : exact[0]!;
  if (gap === "forward") {
    const after = candidates.filter(
      (instant) => localDateTime(instant, timezone) > local
    );
    if (after.length) return after[0]!;
  }
  throw new Error(
    "This local time does not exist because of a daylight-saving change"
  );
}

export function dayBounds(date: string, timezone: string) {
  return {
    startAt: zonedInstant(`${date}T00:00`, timezone, "earlier", "forward"),
    endAt: zonedInstant(
      `${shiftDate(date, 1)}T00:00`,
      timezone,
      "earlier",
      "forward"
    ),
  };
}

export function validatePlanning(settings: PlanningSettings) {
  new Intl.DateTimeFormat("en", { timeZone: settings.timezone });
  const validDate = (date: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    new Date(`${date}T12:00Z`).toISOString().slice(0, 10) === date;
  for (const window of [
    ...settings.weekly,
    ...settings.protectedWeekly,
    ...settings.protectedDates,
    ...settings.overrides.flatMap((o) => o.windows),
  ]) {
    if (
      !Number.isInteger(window.start) ||
      !Number.isInteger(window.end) ||
      window.start < 0 ||
      window.start >= 1440 ||
      window.end < 0 ||
      window.end > 1440 ||
      window.start === window.end
    )
      throw new Error("Enter different start and end times within 00:00–24:00");
  }
  for (const window of [
    ...settings.weekly,
    ...settings.overrides.flatMap((o) => o.windows),
  ])
    if (window.start >= window.end)
      throw new Error("Availability windows must end after they start");
  for (const window of [...settings.weekly, ...settings.protectedWeekly])
    if (
      !Number.isInteger(window.weekday) ||
      window.weekday < 0 ||
      window.weekday > 6
    )
      throw new Error("Invalid weekday");
  for (const item of [...settings.overrides, ...settings.protectedDates])
    if (!validDate(item.date)) throw new Error("Invalid override date");
}

export function mergeWindows(windows: TimeWindow[]) {
  const result: TimeWindow[] = [];
  for (const window of [...windows].sort((a, b) => a.start - b.start)) {
    const last = result[result.length - 1];
    if (last && last.end >= window.start)
      last.end = Math.max(last.end, window.end);
    else result.push({ start: window.start, end: window.end });
  }
  return result;
}

export function availabilityOn(date: string, settings: PlanningSettings) {
  const weekday = new Date(`${date}T12:00Z`).getUTCDay();
  const restricted =
    settings.restrictAvailability ?? settings.weekly.length > 0;
  let windows = restricted
    ? mergeWindows(settings.weekly.filter((w) => w.weekday === weekday))
    : [{ start: 0, end: 1440 }];
  for (const override of settings.overrides.filter((o) => o.date === date)) {
    if (override.mode === "close") windows = [];
    if (override.mode === "replace") windows = mergeWindows(override.windows);
    if (override.mode === "add")
      windows = mergeWindows([...windows, ...override.windows]);
    if (override.mode === "remove")
      for (const cut of override.windows)
        windows = windows.flatMap((w) =>
          cut.end <= w.start || cut.start >= w.end
            ? [w]
            : [
                ...(w.start < cut.start
                  ? [{ start: w.start, end: cut.start }]
                  : []),
                ...(w.end > cut.end ? [{ start: cut.end, end: w.end }] : []),
              ]
        );
  }
  const bounds = dayBounds(date, settings.timezone);
  const offsetAt = (instant: number) =>
    Date.parse(`${localDateTime(instant, settings.timezone)}Z`) - instant;
  const firstOffset = offsetAt(bounds.startAt);
  const lastOffset = offsetAt(bounds.endAt - 60000);
  const segments = [{ ...bounds, offset: firstOffset }];
  if (firstOffset !== lastOffset) {
    let before = bounds.startAt;
    let after = bounds.endAt - 60000;
    while (after - before > 60000) {
      const middle = before + Math.floor((after - before) / 120000) * 60000;
      if (offsetAt(middle) === firstOffset) before = middle;
      else after = middle;
    }
    segments[0]!.endAt = after;
    segments.push({ startAt: after, endAt: bounds.endAt, offset: lastOffset });
  }
  const midnight = Date.parse(`${date}T00:00Z`);
  const materialize = (localWindows: TimeWindow[]): Interval[] =>
    mergeWindows(
      localWindows.flatMap((window) =>
        segments
          .map((segment) => ({
            start: Math.max(
              segment.startAt,
              midnight + window.start * 60000 - segment.offset
            ),
            end: Math.min(
              segment.endAt,
              midnight + window.end * 60000 - segment.offset
            ),
          }))
          .filter((window) => window.end > window.start)
      )
    ).map(({ start, end }) => ({ startAt: start, endAt: end }));
  const previousDate = shiftDate(date, -1);
  const protectedToday = [
    ...settings.protectedWeekly.filter((w) => w.weekday === weekday),
    ...settings.protectedDates.filter((w) => w.date === date),
  ];
  const protectedYesterday = [
    ...settings.protectedWeekly.filter((w) => w.weekday === (weekday + 6) % 7),
    ...settings.protectedDates.filter((w) => w.date === previousDate),
  ];
  return {
    available: materialize(windows),
    protected: materialize([
      ...protectedToday.map((window) => ({
        start: window.start,
        end: window.end < window.start ? 1440 : window.end,
      })),
      ...protectedYesterday
        .filter((w) => w.end < w.start)
        .map((window) => ({ start: 0, end: window.end })),
    ]),
  };
}

export function overlaps(a: Interval, b: Interval) {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

export function eventsCompatible(a: FixedEvent, b: FixedEvent) {
  return a.attention === "background" && b.attention === "background";
}

export function placementConflicts(
  interval: Interval,
  settings: PlanningSettings | null,
  events: FixedEvent[]
) {
  const reasons = new Set<string>();
  if (settings) {
    let date = localDateTime(interval.startAt, settings.timezone).slice(0, 10);
    const lastDate = localDateTime(interval.endAt - 1, settings.timezone).slice(
      0,
      10
    );
    while (date <= lastDate) {
      const bounds = dayBounds(date, settings.timezone);
      const { available, protected: protectedPeriods } = availabilityOn(
        date,
        settings
      );
      const slice = {
        startAt: Math.max(interval.startAt, bounds.startAt),
        endAt: Math.min(interval.endAt, bounds.endAt),
      };
      if (
        !available.some(
          (w) => w.startAt <= slice.startAt && w.endAt >= slice.endAt
        )
      )
        reasons.add("Outside Availability");
      if (protectedPeriods.some((w) => overlaps(w, slice)))
        reasons.add("Protected period");
      date = shiftDate(date, 1);
    }
  }
  const concurrent = events.filter((e) => overlaps(e, interval));
  for (const event of concurrent)
    if (event.attention === "focused") reasons.add(`Event: ${event.title}`);
  return [...reasons];
}
