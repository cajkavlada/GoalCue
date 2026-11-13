export const MINUTE = 60_000;
export const PIXELS_PER_MINUTE = 1.4;

export function snapMinutes(minutes: number) {
  return Math.round(minutes / 15) * 15;
}

export function layoutSessions<
  T extends { _id: string; startAt: number; endAt: number },
>(sessions: T[]) {
  const positions = new Map<string, { lane: number; lanes: number }>();
  const sorted = [...sessions].sort(
    (a, b) => a.startAt - b.startAt || b.endAt - a.endAt
  );
  let group: T[] = [];
  let groupEnd = 0;
  const finishGroup = () => {
    const ends: number[] = [];
    for (const session of group) {
      let lane = ends.findIndex((end) => end <= session.startAt);
      if (lane < 0) lane = ends.length;
      ends[lane] = session.endAt;
      positions.set(session._id, { lane, lanes: 0 });
    }
    for (const session of group)
      positions.get(session._id)!.lanes = ends.length;
  };
  for (const session of sorted) {
    if (group.length && session.startAt >= groupEnd) {
      finishGroup();
      group = [];
    }
    groupEnd = Math.max(group.length ? groupEnd : session.endAt, session.endAt);
    group.push(session);
  }
  finishGroup();
  return positions;
}

export function freeDayMinutes(
  sessions: { startAt: number; endAt: number }[],
  start: number,
  end: number
) {
  let cursor = start;
  let free = 0;
  for (const session of [...sessions].sort((a, b) => a.startAt - b.startAt)) {
    const from = Math.max(start, session.startAt);
    const to = Math.min(end, session.endAt);
    if (to <= start || from >= end) continue;
    if (from > cursor) free += from - cursor;
    cursor = Math.max(cursor, to);
  }
  return (free + Math.max(0, end - cursor)) / MINUTE;
}

export function adjustSession({
  kind,
  start,
  end,
  pointer,
  offset,
  dayMinutes,
}: {
  kind: "new" | "move" | "start" | "end";
  start: number;
  end: number;
  pointer: number;
  offset: number;
  dayMinutes: number;
}) {
  const minute = snapMinutes(pointer);
  if (kind === "move" || kind === "new") {
    const duration = end - start;
    const latest = Math.floor((dayMinutes - duration) / 15) * 15;
    const from = Math.max(0, Math.min(latest, minute - offset));
    return { start: from, end: from + duration };
  }
  if (kind === "start")
    return {
      start: Math.max(
        0,
        Math.min(Math.max(0, Math.floor((end - 15) / 15) * 15), minute)
      ),
      end,
    };
  return {
    start,
    end: Math.min(
      dayMinutes,
      Math.max(Math.ceil((start + 15) / 15) * 15, minute)
    ),
  };
}
