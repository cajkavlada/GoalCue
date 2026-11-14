import type { FixedEvent, Interval, PlanningSettings } from "./planning";
import {
  availabilityOn,
  dayBounds,
  overlaps,
  placementConflicts,
  shiftDate,
} from "./planning";

type PlanningTask = {
  _id: string;
  title: string;
  effortMinutes?: number;
  minSessionMinutes?: number;
  maxSessionMinutes?: number;
  automaticSchedulingPaused?: boolean;
  priority?: "low" | "normal" | "high" | "critical";
  dueAt?: number;
  finishKind?: "firm" | "preferred";
  archivedAt?: number;
  completedAt?: number;
};
type PlanningSession = Interval & {
  _id: string;
  taskId: string;
  pinned?: boolean;
  manualOverride?: boolean;
  unscheduledAt?: number;
};

export function planSessions({
  date,
  settings,
  events,
  tasks,
  sessions,
  now,
  replanAll = false,
}: {
  date: string;
  settings: PlanningSettings;
  events: FixedEvent[];
  tasks: PlanningTask[];
  sessions: PlanningSession[];
  now: number;
  replanAll?: boolean;
}) {
  const startAt = Math.max(dayBounds(date, settings.timezone).startAt, now);
  const endAt = dayBounds(shiftDate(date, 7), settings.timezone).startAt;
  const windows = Array.from({ length: 7 }, (_, i) =>
    availabilityOn(shiftDate(date, i), settings)
  );
  const hardBlocks = [
    ...windows.flatMap((w) => w.protected),
    ...events.filter((e) => e.attention === "focused"),
  ];
  const available = windows
    .flatMap((w) => w.available)
    .map((w) => ({ startAt: Math.max(startAt, w.startAt), endAt: w.endAt }))
    .filter((w) => w.startAt < w.endAt);
  const gaps = (blocks: Interval[], until = endAt) => {
    let free = available
      .map((w) => ({ ...w, endAt: Math.min(w.endAt, until) }))
      .filter((w) => w.startAt < w.endAt);
    for (const block of [...hardBlocks, ...blocks]) {
      free = free.flatMap((w) =>
        !overlaps(w, block)
          ? [w]
          : [
              ...(w.startAt < block.startAt
                ? [{ startAt: w.startAt, endAt: block.startAt }]
                : []),
              ...(w.endAt > block.endAt
                ? [{ startAt: block.endAt, endAt: w.endAt }]
                : []),
            ]
      );
    }
    return free;
  };
  const priority = { low: 0, normal: 1, high: 2, critical: 3 };
  const eligible = tasks.filter(
    (t) => t.archivedAt === undefined && t.completedAt === undefined
  );
  const byId = new Map(eligible.map((t) => [t._id, t]));
  const duration = (s: Interval) => (s.endAt - s.startAt) / 60000;
  const original = sessions.filter((s) => s.unscheduledAt === undefined);
  const urgency = new Map<string, boolean>();
  const pressing = (t: PlanningTask) => {
    if (urgency.has(t._id)) return urgency.get(t._id)!;
    if (
      t.dueAt === undefined ||
      t.dueAt > endAt ||
      t.finishKind === "preferred"
    )
      return false;
    const capacity = gaps(
      original.filter((s) => s.taskId !== t._id),
      t.dueAt
    ).reduce((n, w) => n + duration(w), 0);
    const outside = original
      .filter(
        (s) => s.taskId === t._id && s.endAt <= startAt && s.endAt <= t.dueAt!
      )
      .reduce((n, s) => n + duration(s), 0);
    const remaining = Math.max(0, (t.effortMinutes ?? 0) - outside);
    const urgent = remaining > 0 && remaining * 1.2 >= capacity;
    urgency.set(t._id, urgent);
    return urgent;
  };
  const rank = (t: PlanningTask) =>
    pressing(t) ? 4 : priority[t.priority ?? "normal"];
  const ordered = [...eligible].sort(
    (a, b) =>
      rank(b) - rank(a) ||
      (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) ||
      a._id.localeCompare(b._id)
  );
  let plan = [...original];
  const reasons = new Map<string, string>();
  const conflicts: string[] = [];
  const movable = (s: PlanningSession) =>
    s.startAt >= startAt &&
    s.endAt <= endAt &&
    !s.pinned &&
    !(s.startAt <= now && now < s.endAt);
  const invalid = (s: PlanningSession) => {
    const t = byId.get(s.taskId);
    return (
      placementConflicts(s, settings, events).length > 0 ||
      (s.manualOverride === false &&
        t !== undefined &&
        (duration(s) < (t.minSessionMinutes ?? 15) ||
          duration(s) > (t.maxSessionMinutes ?? 60))) ||
      (t?.dueAt !== undefined &&
        t.finishKind !== "preferred" &&
        s.endAt > t.dueAt)
    );
  };
  for (const s of original.filter((s) => overlaps(s, { startAt, endAt }))) {
    const task = byId.get(s.taskId);
    if (!task && movable(s)) {
      plan = plan.filter((p) => p._id !== s._id);
      reasons.set(s._id, "Task completed or archived");
    } else if (
      replanAll &&
      task &&
      !task.automaticSchedulingPaused &&
      movable(s)
    ) {
      plan = plan.filter((p) => p._id !== s._id);
      reasons.set(s._id, "Rebuild future schedule at your request");
    } else if (invalid(s)) {
      if (movable(s)) {
        plan = plan.filter((p) => p._id !== s._id);
        reasons.set(
          s._id,
          "Placement conflicts with a boundary or Firm deadline"
        );
      } else
        conflicts.push(
          `${task?.title ?? "Session"}: resolve the pinned or active placement conflict`
        );
    }
  }
  const accepted: PlanningSession[] = [];
  for (const s of [...plan].sort(
    (a, b) =>
      Number(movable(a) && a.manualOverride === false) -
        Number(movable(b) && b.manualOverride === false) ||
      rank(byId.get(b.taskId) ?? { _id: "", title: "" }) -
        rank(byId.get(a.taskId) ?? { _id: "", title: "" }) ||
      a.startAt - b.startAt
  )) {
    if (
      overlaps(s, { startAt, endAt }) &&
      accepted.some((other) => overlaps(other, s))
    ) {
      if (movable(s) && s.manualOverride === false) {
        plan = plan.filter((p) => p._id !== s._id);
        reasons.set(s._id, "Resolve overlapping Sessions");
        continue;
      }
      conflicts.push(
        `${byId.get(s.taskId)?.title ?? "Session"}: resolve overlapping pinned, active, or manual placements`
      );
    }
    accepted.push(s);
  }
  let sequence = 0;
  const place = (
    task: PlanningTask,
    current: PlanningSession[],
    needed: number
  ) => {
    const result = [...current];
    const minimum = task.minSessionMinutes ?? 15;
    const maximum = task.maxSessionMinutes ?? 60;
    const until =
      task.finishKind !== "preferred" ? (task.dueAt ?? endAt) : endAt;
    const removed = original.filter(
      (s) => s.taskId === task._id && !current.some((p) => p._id === s._id)
    );
    const free = gaps(result, until);
    if (!replanAll && removed.length) {
      const preferred = removed[0]!.startAt;
      free.sort(
        (a, b) =>
          Math.abs(
            Math.max(
              a.startAt,
              Math.min(preferred, a.endAt - minimum * 60000)
            ) - preferred
          ) -
          Math.abs(
            Math.max(
              b.startAt,
              Math.min(preferred, b.endAt - minimum * 60000)
            ) - preferred
          )
      );
    }
    for (const window of free) {
      let cursor = window.startAt;
      const preferred = removed[0];
      if (
        !replanAll &&
        preferred &&
        preferred.startAt >= cursor &&
        preferred.endAt <= window.endAt &&
        duration(preferred) <= maximum &&
        duration(preferred) >= minimum
      )
        cursor = preferred.startAt;
      while (needed >= minimum && (window.endAt - cursor) / 60000 >= minimum) {
        const previous = removed.shift();
        let minutes = Math.min(
          needed,
          maximum,
          (window.endAt - cursor) / 60000
        );
        if (needed > minutes && needed - minutes < minimum)
          minutes -= minimum - (needed - minutes);
        if (minutes < minimum) break;
        const s = {
          _id: previous?._id ?? `new:${sequence++}`,
          taskId: task._id,
          startAt: cursor,
          endAt: cursor + minutes * 60000,
        };
        result.push(s);
        needed -= minutes;
        cursor = s.endAt;
      }
    }
    return { plan: result, needed };
  };
  for (const task of ordered) {
    if (task.automaticSchedulingPaused) continue;
    const scheduled = plan
      .filter((s) => s.taskId === task._id)
      .reduce((n, s) => n + duration(s), 0);
    const removedMinutes = original
      .filter(
        (s) => s.taskId === task._id && !plan.some((p) => p._id === s._id)
      )
      .reduce((n, s) => n + duration(s), 0);
    const needed = Math.max(
      0,
      (task.effortMinutes ?? scheduled + removedMinutes) - scheduled
    );
    let attempt = place(task, plan, needed);
    if (
      attempt.needed > 0 &&
      (pressing(task) || priority[task.priority ?? "normal"] >= 2)
    ) {
      const candidates = plan
        .filter((s) => {
          const owner = byId.get(s.taskId);
          return (
            owner &&
            s.taskId !== task._id &&
            movable(s) &&
            s.manualOverride === false &&
            rank(owner) < rank(task) &&
            s.startAt <
              (task.finishKind !== "preferred" ? (task.dueAt ?? endAt) : endAt)
          );
        })
        .sort(
          (a, b) =>
            rank(byId.get(a.taskId)!) - rank(byId.get(b.taskId)!) ||
            b.startAt - a.startAt
        );
      let trial = [...plan];
      const displaced: PlanningSession[] = [];
      for (const candidate of candidates) {
        trial = trial.filter((s) => s._id !== candidate._id);
        displaced.push(candidate);
        const next = place(task, trial, needed);
        if (next.needed < attempt.needed) {
          attempt = next;
          for (const s of displaced) {
            if (trial.some((p) => p._id === s._id)) continue;
            const restored = [...trial, s];
            const smaller = place(task, restored, needed);
            if (smaller.needed <= attempt.needed) {
              trial = restored;
              attempt = smaller;
            }
          }
          for (const s of displaced.filter(
            (s) => !trial.some((p) => p._id === s._id)
          ))
            reasons.set(s._id, `Make room for pressing Task: ${task.title}`);
        }
        if (attempt.needed === 0) break;
      }
    }
    plan = attempt.plan;
  }
  const changes = [
    ...original
      .filter((s) => !plan.some((p) => p._id === s._id))
      .map((s) => ({
        id: s._id,
        taskId: s.taskId,
        before: { startAt: s.startAt, endAt: s.endAt },
        after: undefined as Interval | undefined,
        reason: reasons.get(s._id) ?? "Make room for pressing work",
      })),
    ...plan
      .filter((s) => {
        const before = original.find((p) => p._id === s._id);
        return (
          !before || before.startAt !== s.startAt || before.endAt !== s.endAt
        );
      })
      .map((s) => {
        const previous = original.find((p) => p._id === s._id);
        return {
          id: s._id,
          taskId: s.taskId,
          before: previous
            ? { startAt: previous.startAt, endAt: previous.endAt }
            : undefined,
          after: { startAt: s.startAt, endAt: s.endAt } as Interval | undefined,
          reason:
            reasons.get(s._id) ?? "Place estimated effort in available time",
        };
      }),
  ];
  const shortfalls = eligible
    .filter((t) => !t.automaticSchedulingPaused)
    .flatMap((task) => {
      if (task.effortMinutes === undefined)
        return [
          {
            taskId: task._id,
            title: task.title,
            minutes: 0,
            reason: "Add an Effort estimate for automatic planning",
          },
        ];
      const until =
        task.finishKind !== "preferred" ? (task.dueAt ?? endAt) : endAt;
      const planned = plan
        .filter((s) => s.taskId === task._id && s.endAt <= until)
        .reduce((n, s) => n + duration(s), 0);
      const minutes = Math.max(0, task.effortMinutes - planned);
      return minutes > 0
        ? [
            {
              taskId: task._id,
              title: task.title,
              minutes,
              reason:
                "Insufficient compatible time within the next seven days or before the Firm deadline",
            },
          ]
        : [];
    });
  return { changes, shortfalls, conflicts };
}
