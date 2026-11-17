import { zonedInstant } from "@gc/validators";

export type GoogleEvent = {
  id: string;
  summary?: string;
  status?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: { date?: string; dateTime?: string; timeZone?: string };
  iCalUID?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
};

export function calendarEvent(
  event: GoogleEvent,
  timezone: string,
  recurrence?: string[]
) {
  const zone = event.start?.timeZone ?? timezone;
  const allDayStart = event.start?.date;
  const allDayEnd = event.end?.date;
  if (!event.id || !event.start || !event.end || !!allDayStart !== !!allDayEnd)
    throw new Error("Incomplete calendar Event");
  const startAt = allDayStart
    ? zonedInstant(`${allDayStart}T00:00`, zone, "earlier", "forward")
    : Date.parse(event.start.dateTime ?? "");
  const endAt = allDayEnd
    ? zonedInstant(`${allDayEnd}T00:00`, zone, "earlier", "forward")
    : Date.parse(event.end.dateTime ?? "");
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt)
    throw new Error("Invalid calendar Event times");
  return {
    sourceEventId: event.id,
    title: event.summary?.trim() || "Untitled Event",
    startAt,
    endAt,
    timezone: zone,
    allDayStart,
    allDayEnd,
    sourceStatus: event.status,
    sourceUrl: event.htmlLink,
    location: event.location,
    meetingLink:
      event.hangoutLink ??
      event.conferenceData?.entryPoints?.find(
        (p) => p.entryPointType === "video"
      )?.uri,
    recurrence: event.recurrence ?? recurrence,
    recurringEventId: event.recurringEventId,
    originalStart:
      event.originalStartTime?.date ?? event.originalStartTime?.dateTime,
    iCalUID: event.iCalUID,
  };
}
