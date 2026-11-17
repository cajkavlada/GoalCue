import ICAL from "ical.js";

import { dayBounds, zonedInstant } from "@gc/validators";

export function parseWorkCalendar(
  text: string,
  from: string,
  to: string,
  timezone: string
) {
  const start = dayBounds(from, timezone).startAt;
  const end = dayBounds(to, timezone).startAt;
  if (end <= start || end - start > 367 * 86400000)
    throw new Error(
      "Choose an exclusive end date within one year of the start"
    );
  if (text.length > 500000)
    throw new Error("Choose an ICS file smaller than 500 KB");
  const calendar = new ICAL.Component(ICAL.parse(text));
  if (
    calendar.name !== "vcalendar" ||
    !text.trimEnd().endsWith("END:VCALENDAR")
  )
    throw new Error("Choose a complete ICS calendar file");
  const components = calendar.getAllSubcomponents("vevent");
  const errors: string[] = [];
  const cancellations = components
    .filter((c) => c.getFirstPropertyValue("status") === "CANCELLED")
    .map((c) => ({
      uid: String(c.getFirstPropertyValue("uid") ?? ""),
      recurrenceId: c.hasProperty("recurrence-id")
        ? String(c.getFirstPropertyValue("recurrence-id"))
        : "",
    }));
  const events: {
    key: string;
    title: string;
    startAt: number;
    endAt: number;
    timezone: string;
    cancelled: boolean;
    allDayStart?: string;
    allDayEnd?: string;
    location?: string;
    meetingLink?: string;
    sourceLink?: string;
    recurrence?: string[];
  }[] = [];
  const instant = (time: ICAL.Time, component: ICAL.Component) => {
    const zone = String(
      component.getFirstProperty("dtstart")?.getParameter("tzid") ?? timezone
    );
    if (time.isDate || time.zone.tzid === "floating")
      return (
        zonedInstant(
          time.toString().slice(0, 10) +
            "T" +
            (time.isDate ? "00:00" : time.toString().slice(11, 16)),
          zone
        ) + (time.isDate ? 0 : time.second * 1000)
      );
    return time.toUnixTime() * 1000;
  };
  const seen = new Set<string>();
  for (const component of components) {
    if (component.hasProperty("recurrence-id")) continue;
    const uid = String(component.getFirstPropertyValue("uid") ?? "");
    try {
      if (!uid || seen.has(uid)) throw new Error("Missing or duplicate UID");
      seen.add(uid);
      const exceptions = components.filter(
        (c) =>
          c.hasProperty("recurrence-id") &&
          c.hasProperty("dtstart") &&
          c.getFirstPropertyValue("uid") === uid
      );
      const event = new ICAL.Event(component, { exceptions });
      if (
        new Set(
          exceptions.map((c) =>
            String(c.getFirstPropertyValue("recurrence-id"))
          )
        ).size !== exceptions.length
      )
        throw new Error("Duplicate recurrence exception");
      if (!component.hasProperty("dtstart")) {
        if (component.getFirstPropertyValue("status") === "CANCELLED") continue;
        throw new Error("Missing DTSTART");
      }
      const iterator = event.iterator();
      let expansionEnd = end;
      for (const exception of exceptions) {
        const item = new ICAL.Event(exception);
        const movedStart = instant(item.startDate, exception);
        if (movedStart >= start && movedStart < end)
          expansionEnd = Math.max(
            expansionEnd,
            instant(item.recurrenceId, component) + 1
          );
      }
      let iterations = 0;
      let occurrence: ICAL.Time | null;
      while ((occurrence = iterator.next())) {
        if (++iterations > 10000)
          throw new Error("Recurrence exceeds the import limit");
        const original = instant(occurrence, component);
        const recurrenceKey = occurrence.toString();
        if (original >= expansionEnd) break;
        if (
          cancellations.some(
            (c) => c.uid === uid && c.recurrenceId === recurrenceKey
          ) &&
          !exceptions.some(
            (c) =>
              String(c.getFirstPropertyValue("recurrence-id")) === recurrenceKey
          )
        )
          continue;
        const details = event.getOccurrenceDetails(occurrence);
        const item = details.item.component;
        const startAt = instant(details.startDate, item);
        const endAt = instant(details.endDate, item);
        if (endAt <= startAt || !Number.isFinite(startAt + endAt))
          throw new Error("Invalid Event duration");
        if (startAt >= end || endAt <= start) continue;
        const value = (name: string) => {
          const result =
            item.getFirstPropertyValue(name) ??
            component.getFirstPropertyValue(name);
          return result === null ? undefined : String(result);
        };
        const sourceLink = value("url");
        const description = value("description") ?? "";
        const meetingLink =
          value("conference") ??
          description.match(/https:\/\/[^\s<>"\\]+/i)?.[0];
        events.push({
          key: JSON.stringify([
            uid,
            event.isRecurring() ? occurrence.toString() : "",
          ]),
          title: value("summary") || "Busy",
          startAt,
          endAt,
          timezone: String(
            item.getFirstProperty("dtstart")?.getParameter("tzid") ??
              (details.startDate.zone.tzid === "UTC" ? "UTC" : timezone)
          ),
          cancelled: value("status") === "CANCELLED",
          ...(details.startDate.isDate
            ? {
                allDayStart: details.startDate.toString(),
                allDayEnd: details.endDate.toString(),
              }
            : {}),
          ...(value("location") ? { location: value("location") } : {}),
          ...(meetingLink ? { meetingLink } : {}),
          ...(sourceLink ? { sourceLink } : {}),
          ...(component.hasProperty("rrule")
            ? { recurrence: [String(component.getFirstPropertyValue("rrule"))] }
            : {}),
        });
        if (events.length > 500)
          throw new Error("Import at most 500 Events at a time");
        if (!event.isRecurring()) break;
      }
    } catch (error) {
      errors.push(
        `${uid || "Event"}: ${error instanceof Error ? error.message : "Invalid Event"}`
      );
      if (events.length > 500) break;
    }
  }
  for (const component of components.filter((c) =>
    c.hasProperty("recurrence-id")
  )) {
    if (
      !component.getFirstPropertyValue("uid") ||
      (component.getFirstPropertyValue("status") !== "CANCELLED" &&
        (!component.hasProperty("dtstart") ||
          !seen.has(String(component.getFirstPropertyValue("uid")))))
    )
      errors.push(
        "A recurrence exception is missing its UID, start, or series"
      );
  }
  return { events, errors, cancellations };
}
