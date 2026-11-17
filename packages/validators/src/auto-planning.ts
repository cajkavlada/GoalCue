import type { FixedEvent, Interval, PlanningSettings } from "./planning";
import {
  availabilityOn,
  dayBounds,
  localDateTime,
  overlaps,
  placementConflicts,
  shiftDate,
} from "./planning";

type PlanningTask = {
  _id: string;
  projectId?: string;
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
  occurrenceStartAt?: number;
  occurrenceEndAt?: number;
  occurrenceCarryForward?: boolean;
  expiredAt?: number;
};
type PlanningSession = Interval & {
  _id: string;
  taskId: string;
  pinned?: boolean;
  manualOverride?: boolean;
  unscheduledAt?: number;
  checkInUpdatedAt?: number;
  planningEffortMinutes?: number;
  checkIn?: {
    reportedAt: number;
    timeMinutes: number;
    remainingMinutes?: number;
  };
};

export function planSessions({
  date,
  settings,
  events,
  tasks,
  sessions,
  now,
  replanAll = false,
  projects = [],
}: {
  date: string;
  settings: PlanningSettings;
  events: FixedEvent[];
  tasks: PlanningTask[];
  sessions: PlanningSession[];
  now: number;
  replanAll?: boolean;
  projects?: {
    _id: string;
    title: string;
    weeklyMinutes: number;
    weekdays: number[];
  }[];
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
    (t) =>
      t.archivedAt === undefined &&
      t.completedAt === undefined &&
      t.expiredAt === undefined
  );
  const byId = new Map(eligible.map((t) => [t._id, t]));
  const duration = (s: Interval) => (s.endAt - s.startAt) / 60000;
  const credit = (s: PlanningSession) =>
    s.checkIn ? s.checkIn.timeMinutes : duration(s);
  const original = sessions.filter((s) => s.unscheduledAt === undefined);
  const effort = (task: PlanningTask) => {
    const reports = original
      .filter(
        (s) =>
          s.taskId === task._id && s.checkIn?.remainingMinutes !== undefined
      )
      .sort((a, b) => b.checkIn!.reportedAt - a.checkIn!.reportedAt);
    const latest = reports[0]?.checkIn;
    return latest
      ? latest.remainingMinutes! +
          original
            .filter(
              (s) =>
                s.taskId === task._id &&
                (s.checkIn
                  ? s.checkIn.reportedAt <= latest.reportedAt
                  : s.endAt <= latest.reportedAt)
            )
            .reduce((n, s) => n + credit(s), 0)
      : (task.effortMinutes ??
          original.find(
            (s) =>
              s.taskId === task._id && s.planningEffortMinutes !== undefined
          )?.planningEffortMinutes);
  };
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
      .reduce((n, s) => n + credit(s), 0);
    const remaining = Math.max(0, (effort(t) ?? 0) - outside);
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
    !s.checkIn &&
    !(s.startAt <= now && now < s.endAt);
  for (const task of eligible) {
    if (
      !original.some(
        (s) => s.taskId === task._id && s.checkInUpdatedAt !== undefined
      )
    )
      continue;
    let excess =
      plan
        .filter((s) => s.taskId === task._id)
        .reduce((n, s) => n + credit(s), 0) - (effort(task) ?? Infinity);
    for (const s of [...plan].sort((a, b) => b.startAt - a.startAt)) {
      if (excess <= 0) break;
      if (s.taskId !== task._id || !movable(s) || s.manualOverride !== false)
        continue;
      plan = plan.filter((p) => p._id !== s._id);
      excess -= credit(s);
      reasons.set(s._id, "Update remaining plan from Check-in");
    }
  }
  const invalid = (s: PlanningSession) => {
    const t = byId.get(s.taskId);
    return (
      placementConflicts(s, settings, events).length > 0 ||
      (s.manualOverride === false &&
        t !== undefined &&
        (duration(s) <
          Math.min(
            t.minSessionMinutes ?? 15,
            Math.max(
              1,
              (effort(t) ?? Infinity) -
                original
                  .filter(
                    (other) => other.taskId === t._id && other._id !== s._id
                  )
                  .reduce((sum, other) => sum + credit(other), 0)
            )
          ) ||
          duration(s) > (t.maxSessionMinutes ?? 60))) ||
      (t?.dueAt !== undefined &&
        t.finishKind !== "preferred" &&
        s.endAt > t.dueAt) ||
      (t?.occurrenceStartAt !== undefined && s.startAt < t.occurrenceStartAt) ||
      (t?.occurrenceEndAt !== undefined &&
        !t.occurrenceCarryForward &&
        s.endAt > t.occurrenceEndAt)
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
    needed: number,
    options?: { date?: string; oneSession?: boolean }
  ) => {
    const result = [...current];
    if (needed <= 0) return { plan: result, needed };
    const minimum = Math.min(task.minSessionMinutes ?? 15, needed);
    const maximum = task.maxSessionMinutes ?? 60;
    const until = Math.min(
      task.finishKind !== "preferred" ? (task.dueAt ?? endAt) : endAt,
      task.occurrenceCarryForward ? endAt : (task.occurrenceEndAt ?? endAt)
    );
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
      const windowDate = localDateTime(window.startAt, settings.timezone).slice(
        0,
        10
      );
      if (options?.date && windowDate !== options.date) continue;
      const day = dayBounds(windowDate, settings.timezone);
      const lowLimit = replanAll
        ? 1
        : Math.max(
            1,
            original.filter(
              (s) => s.taskId === task._id && credit(s) > 0 && overlaps(s, day)
            ).length
          );
      let cursor = Math.max(
        window.startAt,
        task.occurrenceStartAt ?? window.startAt
      );
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
        if (
          task.priority === "low" &&
          !pressing(task) &&
          result.filter(
            (s) => s.taskId === task._id && credit(s) > 0 && overlaps(s, day)
          ).length >= lowLimit
        )
          break;
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
        if (options?.oneSession) return { plan: result, needed };
      }
    }
    return { plan: result, needed };
  };
  const scheduleTask = (task: PlanningTask) => {
    if (task.automaticSchedulingPaused) return;
    const scheduled = plan
      .filter((s) => s.taskId === task._id)
      .reduce((n, s) => n + credit(s), 0);
    const removedMinutes = original
      .filter(
        (s) => s.taskId === task._id && !plan.some((p) => p._id === s._id)
      )
      .reduce((n, s) => n + duration(s), 0);
    const needed = Math.max(
      0,
      (effort(task) ?? scheduled + removedMinutes) - scheduled
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
            (pressing(task) ||
              !projects.some(
                (p) => p._id === owner.projectId && p.weeklyMinutes > 0
              )) &&
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
  };
  const urgent = ordered.filter(
    (task) => pressing(task) || task.priority === "critical"
  );
  for (const task of urgent) scheduleTask(task);
  const projectShortfalls: {
    projectId: string;
    title: string;
    minutes: number;
    reason: string;
    week: string;
  }[] = [];
  for (const project of projects.filter((p) => p.weeklyMinutes > 0)) {
    const members = tasks.filter((t) => t.projectId === project._id);
    const ready = ordered.filter(
      (t) =>
        t.projectId === project._id &&
        !t.automaticSchedulingPaused &&
        effort(t) !== undefined
    );
    const weekday = new Date(`${date}T12:00Z`).getUTCDay();
    const firstWeek = shiftDate(
      date,
      -((weekday - (settings.weekStartsOn ?? 1) + 7) % 7)
    );
    for (
      let week = firstWeek;
      week < shiftDate(date, 7);
      week = shiftDate(week, 7)
    ) {
      const weekBounds = {
        startAt: dayBounds(week, settings.timezone).startAt,
        endAt: dayBounds(shiftDate(week, 7), settings.timezone).startAt,
      };
      const plannedMinutes = () =>
        plan
          .filter(
            (s) =>
              members.some((t) => t._id === s.taskId) && overlaps(s, weekBounds)
          )
          .reduce(
            (total, s) =>
              total +
              (credit(s) *
                duration({
                  startAt: Math.max(s.startAt, weekBounds.startAt),
                  endAt: Math.min(s.endAt, weekBounds.endAt),
                })) /
                duration(s),
            0
          );
      const days = Array.from({ length: 7 }, (_, i) =>
        shiftDate(week, i)
      ).filter(
        (d) =>
          d >= date &&
          d < shiftDate(date, 7) &&
          (!project.weekdays.length ||
            project.weekdays.includes(new Date(`${d}T12:00Z`).getUTCDay()))
      );
      for (let i = 0; i < days.length; i++) {
        let budget = Math.ceil(
          Math.max(0, project.weeklyMinutes - plannedMinutes()) /
            (days.length - i)
        );
        for (const task of ready) {
          if (budget <= 0) break;
          const scheduled = plan
            .filter((s) => s.taskId === task._id)
            .reduce((n, s) => n + credit(s), 0);
          const remaining = Math.max(0, effort(task)! - scheduled);
          const needed = Math.min(
            remaining,
            Math.max(budget, task.minSessionMinutes ?? 15)
          );
          const attempt = place(task, plan, needed, { date: days[i] });
          budget -= needed - attempt.needed;
          for (const session of attempt.plan)
            if (!plan.some((s) => s._id === session._id))
              reasons.set(
                session._id,
                `Reserve weekly Project time: ${project.title}`
              );
          plan = attempt.plan;
        }
      }
      const minutes = Math.max(0, project.weeklyMinutes - plannedMinutes());
      if (minutes > 0)
        projectShortfalls.push({
          projectId: project._id,
          title: project.title,
          minutes,
          week,
          reason: ready.length
            ? `Weekly time target not met for ${week}; choose more ready work or compatible time`
            : "Choose or break down the next Task and add an Effort estimate",
        });
    }
  }
  const ordinary = ordered.filter(
    (task) => !urgent.includes(task) && !task.automaticSchedulingPaused
  );
  if (ordinary.length > 1) {
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const currentDate = shiftDate(date, dayIndex);
      const day = dayBounds(currentDate, settings.timezone);
      const waitingRank = (task: PlanningTask) => {
        const last = plan
          .filter(
            (s) =>
              s.taskId === task._id && credit(s) > 0 && s.startAt < day.startAt
          )
          .sort((a, b) => b.startAt - a.startAt)[0];
        const lastDate = last
          ? localDateTime(last.startAt, settings.timezone).slice(0, 10)
          : shiftDate(date, -1);
        const waitingDays = Math.max(
          0,
          (Date.parse(currentDate) - Date.parse(lastDate)) / 86400000 - 1
        );
        return priority[task.priority ?? "normal"] + Math.min(3, waitingDays);
      };
      for (let round = 0; round < 3; round++) {
        const candidates = [...ordinary].sort(
          (a, b) =>
            waitingRank(b) - waitingRank(a) ||
            rank(b) - rank(a) ||
            (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) ||
            a._id.localeCompare(b._id)
        );
        for (const task of candidates) {
          const daily = plan.filter(
            (s) => s.taskId === task._id && credit(s) > 0 && overlaps(s, day)
          );
          if (daily.length >= priority[task.priority ?? "normal"] + 1) continue;
          const scheduled = plan
            .filter((s) => s.taskId === task._id)
            .reduce((sum, s) => sum + credit(s), 0);
          const needed = Math.max(0, (effort(task) ?? scheduled) - scheduled);
          const attempt = place(task, plan, needed, {
            date: currentDate,
            oneSession: true,
          });
          for (const session of attempt.plan) {
            if (
              !plan.some((s) => s._id === session._id) &&
              !reasons.has(session._id)
            )
              reasons.set(
                session._id,
                "Give Tasks a turn according to Priority and waiting time"
              );
          }
          plan = attempt.plan;
        }
      }
    }
  }
  for (const task of ordinary) scheduleTask(task);
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
      if (effort(task) === undefined)
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
        .reduce((n, s) => n + credit(s), 0);
      const minutes = Math.max(0, effort(task)! - planned);
      return minutes > 0
        ? [
            {
              taskId: task._id,
              title: task.title,
              minutes,
              reason:
                task.priority === "low" && !pressing(task)
                  ? "Remaining effort does not fit at one Session per day within the next seven days, or before the Firm deadline"
                  : "Insufficient compatible time within the next seven days or before the Firm deadline",
            },
          ]
        : [];
    });
  return {
    changes,
    shortfalls,
    conflicts,
    projectShortfalls: projectShortfalls.flatMap(({ week, ...shortfall }) => {
      const bounds = {
        startAt: dayBounds(week, settings.timezone).startAt,
        endAt: dayBounds(shiftDate(week, 7), settings.timezone).startAt,
      };
      const planned = plan
        .filter(
          (s) =>
            overlaps(s, bounds) &&
            tasks.some(
              (t) => t._id === s.taskId && t.projectId === shortfall.projectId
            )
        )
        .reduce(
          (n, s) =>
            n +
            (credit(s) *
              duration({
                startAt: Math.max(s.startAt, bounds.startAt),
                endAt: Math.min(s.endAt, bounds.endAt),
              })) /
              duration(s),
          0
        );
      const minutes = Math.max(
        0,
        projects.find((p) => p._id === shortfall.projectId)!.weeklyMinutes -
          planned
      );
      return minutes > 0 ? [{ ...shortfall, minutes }] : [];
    }),
  };
}
