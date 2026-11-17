import type { FixedEvent, Interval } from "./planning";
import { dayBounds, localDateTime, overlaps } from "./planning";

export type Attendance = {
  attendance?: "unknown" | "online" | "physical" | "hybrid";
  hybridAttendance?: "online" | "physical";
  locationRequirement?: string;
};
export type JourneyInput = {
  origin: string;
  mode: "walk" | "cycle" | "drive" | "transit";
  routeMinutes?: number;
  marginPercent: number;
  arrivalMinutes: number;
  wrapUpMinutes: number;
};

export function physicalAttendance(item: Attendance) {
  return (
    item.attendance === "physical" ||
    (item.attendance === "hybrid" && item.hybridAttendance === "physical")
  );
}

export function validateTravel(item: Attendance & { journey?: JourneyInput }) {
  if ((item.locationRequirement?.length ?? 0) > 500)
    throw new Error("Use a location of at most 500 characters");
  if (!item.journey) return;
  const j = item.journey;
  if (
    j.origin.length > 500 ||
    [j.routeMinutes, j.marginPercent, j.arrivalMinutes, j.wrapUpMinutes].some(
      (n) => n !== undefined && (!Number.isFinite(n) || n < 0 || n > 10080)
    )
  )
    throw new Error(
      "Enter nonnegative travel durations and margin within one week"
    );
}

export function planTravel(events: FixedEvent[]) {
  const ordered = [...events].sort((a, b) => a.startAt - b.startAt);
  const blocks: (Interval & { title: string })[] = [];
  const journeys: (Interval & {
    title: string;
    eventStartAt: number;
    origin: string;
    destination: string;
    mode: JourneyInput["mode"] | undefined;
    routeMinutes: number | undefined;
    marginMinutes: number;
    arrivalMinutes: number;
    wrapUpMinutes: number;
    uncertainty: string;
    shortfallMinutes: number;
  })[] = [];
  let previous: FixedEvent | undefined;
  for (const event of ordered) {
    const physical = physicalAttendance(event);
    if (!physical) {
      if (
        !event.attendance ||
        event.attendance === "unknown" ||
        (event.attendance === "hybrid" && !event.hybridAttendance)
      ) {
        journeys.push({
          ...event,
          endAt: event.startAt,
          eventStartAt: event.startAt,
          origin: "",
          destination: "",
          mode: undefined,
          routeMinutes: undefined,
          marginMinutes: 0,
          arrivalMinutes: 0,
          wrapUpMinutes: 0,
          uncertainty:
            "Choose attendance and resolve the location before confirming travel",
          shortfallMinutes: 0,
        });
      }
      previous = event;
      continue;
    }
    const j = event.journey;
    const destination = event.locationRequirement?.trim() ?? "";
    const knownOrigin =
      previous && physicalAttendance(previous)
        ? previous.locationRequirement?.trim()
        : undefined;
    const origin = j?.origin.trim() || knownOrigin || "";
    const samePlace = !!origin && origin === destination;
    const routeMinutes = samePlace ? 0 : j?.routeMinutes;
    const marginMinutes =
      ((routeMinutes ?? 0) * (j?.marginPercent ?? 20)) / 100;
    const arrivalMinutes = j?.arrivalMinutes ?? 10;
    const wrapUpMinutes = j?.wrapUpMinutes ?? 0;
    const availableAt = previous
      ? previous.endAt +
        (physicalAttendance(previous)
          ? (previous.journey?.wrapUpMinutes ?? 0)
          : 0) *
          60000
      : undefined;
    const uncertainty = !destination
      ? "Resolve the destination"
      : !origin
        ? "Enter an origin; whereabouts are unknown"
        : knownOrigin && origin !== knownOrigin
          ? "Origin differs from the previous physical Event; confirm the transition"
          : routeMinutes === undefined
            ? "Enter manual route time; travel is unresolved"
            : !knownOrigin && previous
              ? "Origin is assumed; previous whereabouts are unknown"
              : "";
    const arrivalAt = event.startAt - arrivalMinutes * 60000;
    const startAt =
      routeMinutes === undefined || !origin || !destination
        ? Math.min(
            availableAt ??
              dayBounds(
                localDateTime(event.startAt, event.timezone ?? "UTC").slice(
                  0,
                  10
                ),
                event.timezone ?? "UTC"
              ).startAt,
            arrivalAt
          )
        : arrivalAt - (routeMinutes + marginMinutes) * 60000;
    const shortfallMinutes =
      availableAt === undefined
        ? 0
        : Math.max(0, (availableAt - startAt) / 60000);
    journeys.push({
      startAt,
      endAt: arrivalAt,
      title: event.title,
      eventStartAt: event.startAt,
      origin,
      destination,
      mode: j?.mode ?? "drive",
      routeMinutes,
      marginMinutes,
      arrivalMinutes,
      wrapUpMinutes,
      uncertainty,
      shortfallMinutes,
    });
    if (startAt < arrivalAt)
      blocks.push({
        startAt,
        endAt: arrivalAt,
        title: `Journey: ${event.title}`,
      });
    if (arrivalMinutes)
      blocks.push({
        startAt: arrivalAt,
        endAt: event.startAt,
        title: `Arrival buffer: ${event.title}`,
      });
    if (wrapUpMinutes)
      blocks.push({
        startAt: event.endAt,
        endAt: event.endAt + wrapUpMinutes * 60000,
        title: `Wrap-up buffer: ${event.title}`,
      });
    previous = event;
  }
  for (const journey of journeys) {
    if (
      blocks.some(
        (b) => !b.title.endsWith(`: ${journey.title}`) && overlaps(b, journey)
      )
    )
      journey.uncertainty ||=
        "Travel reservations overlap; review this transition";
    if (
      ordered.some(
        (e) => e.startAt !== journey.eventStartAt && overlaps(e, journey)
      )
    )
      journey.uncertainty ||=
        "Journey overlaps a fixed Event; change attendance, mode, or the Event manually";
  }
  return { blocks, journeys };
}

export function locationWindows(
  item: Attendance,
  events: FixedEvent[]
): Interval[] | undefined {
  if (!physicalAttendance(item) && !item.locationRequirement?.trim())
    return item.attendance === "hybrid" && !item.hybridAttendance
      ? []
      : undefined;
  const location = item.locationRequirement?.trim();
  if (!location) return [];
  const ordered = [...events].sort((a, b) => a.startAt - b.startAt);
  const travel = planTravel(ordered);
  return ordered.flatMap((event, index) => {
    if (
      !physicalAttendance(event) ||
      event.locationRequirement?.trim() !== location
    )
      return [];
    const next = ordered
      .slice(index + 1)
      .find(
        (e) =>
          physicalAttendance(e) ||
          !e.attendance ||
          e.attendance === "unknown" ||
          (e.attendance === "hybrid" && !e.hybridAttendance)
      );
    const nextJourney = travel.journeys.find(
      (j) => j.eventStartAt === next?.startAt
    );
    const startAt = event.endAt + (event.journey?.wrapUpMinutes ?? 0) * 60000;
    const endAt =
      nextJourney?.startAt ??
      next?.startAt ??
      dayBounds(
        localDateTime(event.endAt, event.timezone ?? "UTC").slice(0, 10),
        event.timezone ?? "UTC"
      ).endAt;
    return endAt > startAt ? [{ startAt, endAt }] : [];
  });
}

export function locationConflicts(
  interval: Interval,
  item: Attendance,
  events: FixedEvent[]
) {
  const windows = locationWindows(item, events);
  return windows &&
    !windows.some(
      (w) => w.startAt <= interval.startAt && w.endAt >= interval.endAt
    )
    ? [
        "Location requirement is unresolved at this time; plan a Journey or share a compatible visit",
      ]
    : [];
}
