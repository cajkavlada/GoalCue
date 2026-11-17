import { useCallback, useEffect, useRef, useState } from "react";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
  GripVertical,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { usePaginatedQuery } from "@gc/convex";
import { api } from "@gc/convex/api";
import { Doc, Id } from "@gc/convex/types";
import { m } from "@gc/i18n/messages";
import { ErrorSuspense, VirtualList } from "@gc/react-kit";
import {
  ActionMenu,
  Button,
  Checkbox,
  Drawer,
  DropdownMenuItem,
  Input,
  StatusSpinner,
  Tooltip,
  useModal,
} from "@gc/ui";
import {
  availabilityOn,
  dayBounds,
  eventsCompatible,
  localDateTime,
  overlaps,
  placementConflicts,
  zonedInstant,
} from "@gc/validators";

import type { CalendarSession } from "./session-check-ins";
import {
  adjustSession,
  freeDayMinutes,
  layoutSessions,
  MINUTE,
  PIXELS_PER_MINUTE as PX,
  snapMinutes,
} from "./day-calendar-layout";
import {
  EventDetails,
  PlanningDatePicker,
  PlanningTimePicker,
} from "./schedule-constraints";
import {
  CheckInDrawer,
  SessionCheckIn,
  SessionCheckInTray,
  SessionReviewPanel,
} from "./session-check-ins";
import { TaskCard } from "./task-card";
import { TaskDeleteDialog } from "./task-delete-dialog";
import { TaskEditDrawer, TaskProgress } from "./task-edit-drawer";

type Placement = {
  taskId: Id<"tasks">;
  sessionId?: Id<"sessions">;
  startAt: number;
  endAt: number;
};
type Gesture = Placement & {
  kind: "new" | "move" | "start" | "end";
  pointerId: number;
  offset: number;
  x: number;
  y: number;
  originX: number;
  originY: number;
  moved: boolean;
  valid: boolean;
  readOnly: boolean;
};

export function DayView({ selectedDay }: { selectedDay: string }) {
  const { data: settings } = useSuspenseQuery(
    convexQuery(api.planning.getSettings, {})
  );
  const timezone =
    settings?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const day = selectedDay;
  const [tasksOpen, setTasksOpen] = useState(true);
  const [highlightedTaskId, setHighlightedTaskId] =
    useState<Id<"tasks"> | null>(null);
  const [drag, setDrag] = useState<Gesture | null>(null);
  const [pending, setPending] = useState<Placement | null>(null);
  const [interactionError, setInteractionError] = useState("");
  const [search, setSearch] = useState("");
  const [searchText, setSearchText] = useState("");
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchText(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const {
    results: tasks,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.tasks.listForDayPanel,
    { search: searchText },
    { initialNumItems: 30 }
  );
  const { data: sessions } = useSuspenseQuery(
    convexQuery(api.sessions.listSessions, {})
  );
  const { data: events } = useSuspenseQuery(
    convexQuery(api.planning.listEvents, {})
  );
  const { data: dayPlan } = useSuspenseQuery(
    convexQuery(api.planning.getDayPlan, {})
  );
  const planDay = useConvexMutation(api.planning.planDay);
  const replan = useMutation({ mutationFn: planDay });
  const scheduleTask = useMutation({
    mutationFn: useConvexMutation(api.planning.scheduleTask),
  });
  const [planningError, setPlanningError] = useState("");
  useEffect(() => {
    let current = true;
    setPlanningError("");
    const refresh = () =>
      void planDay({ date: day, timezone }).catch((error: Error) => {
        if (current) setPlanningError(error.message);
      });
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      current = false;
      window.clearInterval(timer);
    };
  }, [day, timezone, planDay]);
  const undo = useMutation({
    mutationFn: useConvexMutation(api.planning.undoPlan),
  });
  const clock = (instant: number) =>
    new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZoneName: "shortOffset",
    }).format(instant);
  const save = useMutation({
    mutationFn: useConvexMutation(api.sessions.saveSession),
  });
  const { openDrawer, openDialog } = useModal();
  const openTask = useCallback(
    (taskId: Id<"tasks">) => {
      openDrawer(
        <ErrorSuspense>
          <DayTaskDetails taskId={taskId} />
        </ErrorSuspense>
      );
    },
    [openDrawer]
  );
  const scroll = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const pointer = useRef({ x: 0, y: 0 });
  const { startAt: start, endAt: end } = dayBounds(day, timezone);
  const dayMinutes = (end - start) / MINUTE;
  const suggestedStart = Math.max(
    zonedInstant(`${day}T09:00`, timezone),
    Math.ceil(Date.now() / (15 * MINUTE)) * 15 * MINUTE
  );
  const today = sessions.filter((s) => s.startAt < end && s.endAt > start);
  const constraints = settings
    ? availabilityOn(day, settings)
    : { available: [{ startAt: start, endAt: end }], protected: [] };
  const dayEvents = events.filter(
    (event) => event.startAt < end && event.endAt > start
  );
  const focusedEvents = dayEvents.filter(
    (event) => event.attention === "focused"
  );

  const free = constraints.available.reduce(
    (total, window) =>
      total +
      freeDayMinutes(
        [...today, ...focusedEvents, ...constraints.protected],
        window.startAt,
        window.endAt
      ),
    0
  );
  const editEvent = (event?: Doc<"fixedEvents">) =>
    openDrawer(
      <Drawer
        title={event ? m.constraints_event() : m.constraints_new_event()}
        description={m.constraints_attention_hint()}
        customFooter
      >
        <ErrorSuspense>
          <EventDetails
            day={day}
            timezone={timezone}
            event={event}
          />
        </ErrorSuspense>
      </Drawer>
    );
  const eventConflicts = (event: Doc<"fixedEvents">) => [
    ...events
      .filter(
        (other) =>
          other._id !== event._id &&
          overlaps(other, event) &&
          !eventsCompatible(event, other)
      )
      .map((other) => other.title),
    ...sessions
      .filter(
        (session) => overlaps(session, event) && event.attention === "focused"
      )
      .map((session) => session.taskTitle),
  ];

  const inspect = useCallback(
    (placement: Placement) => {
      openDrawer(
        <Drawer
          title={m.planning_session_details()}
          description={m.planning_session_description()}
          customFooter
        >
          <ErrorSuspense>
            <SessionDetails placement={placement} />
          </ErrorSuspense>
        </Drawer>
      );
    },
    [openDrawer]
  );
  const commit = useCallback(
    (placement: Placement) => {
      const conflicts = placementConflicts(placement, settings, events);
      const blocking = sessions.filter(
        (s) =>
          s._id !== placement.sessionId &&
          s.startAt < placement.endAt &&
          s.endAt > placement.startAt &&
          (s.pinned || s.manualOverride !== false || s.startAt <= Date.now())
      );
      if (blocking.length || conflicts.length) {
        setInteractionError(
          [...conflicts, ...blocking.map((session) => session.taskTitle)].join(
            "; "
          )
        );
        return;
      }
      setInteractionError("");
      setPending(placement);
      save.mutate(placement, {
        onSettled: () => setPending(null),
      });
    },
    [sessions, settings, events, save]
  );
  const handlers = useRef({ commit });
  useEffect(() => {
    handlers.current = { commit };
  }, [commit]);
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 8 * 60 * PX;
  }, [day]);

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const update = () => {
      const current = gesture.current;
      const canvas = surface.current;
      const viewport = scroll.current;
      if (!current || !canvas || !viewport) return;
      const rect = canvas.getBoundingClientRect();
      const box = viewport.getBoundingClientRect();
      if (
        !current.moved &&
        Math.abs(pointer.current.x - current.originX) <= 4 &&
        Math.abs(pointer.current.y - current.originY) <= 4
      )
        return;
      const adjusted = adjustSession({
        kind: current.kind,
        start: (current.startAt - start) / MINUTE,
        end: (current.endAt - start) / MINUTE,
        pointer: (pointer.current.y - rect.top) / PX,
        offset: current.offset,
        dayMinutes,
      });
      const from = adjusted.start;
      const to = adjusted.end;
      const next = {
        ...current,
        startAt: start + from * MINUTE,
        endAt: start + to * MINUTE,
        x: pointer.current.x,
        y: pointer.current.y,
        moved:
          current.moved ||
          Math.abs(pointer.current.x - current.originX) > 4 ||
          Math.abs(pointer.current.y - current.originY) > 4,
        valid:
          !current.readOnly &&
          pointer.current.x >= rect.left &&
          pointer.current.x <= rect.right &&
          pointer.current.y >= box.top &&
          pointer.current.y <= box.bottom,
      };
      gesture.current = next;
      setDrag(next);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== gesture.current?.pointerId) return;
      pointer.current = { x: e.clientX, y: e.clientY };
      update();
    };
    const finish = (e: PointerEvent) => {
      if (e.pointerId !== gesture.current?.pointerId) return;
      pointer.current = { x: e.clientX, y: e.clientY };
      update();
      const current = gesture.current;
      gesture.current = null;
      setDrag(null);
      if (!current) return;
      suppressClick.current = current.moved;
      const placement = {
        taskId: current.taskId,
        sessionId: current.sessionId,
        startAt: current.startAt,
        endAt: current.endAt,
      };
      if (current.moved && current.valid) handlers.current.commit(placement);
    };
    const cancel = () => {
      suppressClick.current = gesture.current?.moved ?? false;
      gesture.current = null;
      setDrag(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    const timer = window.setInterval(() => {
      const element = scroll.current;
      if (!element || !gesture.current?.moved) return;
      const box = element.getBoundingClientRect();
      if (pointer.current.x < box.left || pointer.current.x > box.right) return;
      if (pointer.current.y < box.top + 40) element.scrollTop -= 12;
      else if (pointer.current.y > box.bottom - 40) element.scrollTop += 12;
      update();
    }, 40);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", key);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", key);
    };
  }, [dragging, start, dayMinutes]);

  function begin(
    e: React.PointerEvent,
    taskId: Id<"tasks">,
    kind: Gesture["kind"],
    session?: CalendarSession
  ) {
    if (e.button !== 0 || save.isPending) return;
    suppressClick.current = false;
    const task = tasks.find((t) => t._id === taskId);
    const placement = {
      taskId,
      sessionId: session?._id,
      startAt: session?.startAt ?? suggestedStart,
      endAt:
        session?.endAt ??
        suggestedStart + Math.min(task?.effortMinutes ?? 45, 45) * MINUTE,
    };
    const readOnly = !!(
      session &&
      (session.startAt < start ||
        session.endAt > end ||
        session.taskCompletedAt !== undefined)
    );
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = surface.current!.getBoundingClientRect();
    const next: Gesture = {
      ...placement,
      kind,
      pointerId: e.pointerId,
      offset:
        kind === "move"
          ? snapMinutes(
              (e.clientY - rect.top) / PX - (placement.startAt - start) / MINUTE
            )
          : 0,
      x: e.clientX,
      y: e.clientY,
      originX: e.clientX,
      originY: e.clientY,
      moved: false,
      valid: kind !== "new",
      readOnly,
    };
    pointer.current = { x: e.clientX, y: e.clientY };
    gesture.current = next;
    setDrag(next);
  }

  function handleCalendarClick(e: React.MouseEvent, action: () => void) {
    const suppressed = suppressClick.current;
    suppressClick.current = false;
    if (suppressed && e.detail !== 0) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    action();
  }

  const candidate = drag?.moved && drag.valid ? drag : pending;
  const overlay =
    candidate && candidate.startAt < end && candidate.endAt > start
      ? candidate
      : null;
  const rendered = overlay
    ? overlay.sessionId
      ? today.map((s) =>
          s._id === overlay.sessionId
            ? { ...s, startAt: overlay.startAt, endAt: overlay.endAt }
            : s
        )
      : [
          ...today,
          {
            _id: "preview",
            taskId: overlay.taskId,
            startAt: overlay.startAt,
            endAt: overlay.endAt,
            taskTitle: tasks.find((t) => t._id === overlay.taskId)?.title ?? "",
            taskCompletedAt: undefined,
          },
        ]
    : today;
  const positions = layoutSessions([
    ...rendered.map((session) => ({
      ...session,
      endAt: Math.max(session.endAt, session.startAt + (8 / PX) * MINUTE),
    })),
    ...dayEvents,
  ]);
  const pendingCheckIns = sessions
    .filter(
      (s) =>
        (s.endAt <= now || s.checkInRequestedAt !== undefined) &&
        s.taskCompletedAt === undefined &&
        !s.checkIn &&
        (s.askAfter ?? 0) <= now
    )
    .sort((a, b) => b.endAt - a.endAt || b.startAt - a.startAt);

  return (
    <div className="bg-background flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-1">
        <Button
          size="icon"
          variant="ghost"
          tooltip={
            tasksOpen ? m.planning_hide_tasks() : m.planning_show_tasks()
          }
          aria-label={
            tasksOpen ? m.planning_hide_tasks() : m.planning_show_tasks()
          }
          aria-expanded={tasksOpen}
          aria-controls="day-task-panel"
          onClick={() => setTasksOpen((open) => !open)}
        >
          {tasksOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
        </Button>
        <Button
          variant="outline"
          disabled={replan.isPending || save.isPending}
          onClick={() =>
            replan.mutate({ date: day, timezone, replanAll: true })
          }
        >
          <RefreshCw
            className={replan.isPending ? "animate-spin" : undefined}
          />
          {m.planning_replan_all()}
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 max-md:flex-col">
        <div
          aria-hidden={!tasksOpen}
          inert={!tasksOpen}
          className={`flex min-h-0 shrink-0 flex-col overflow-hidden transition-[width,height,opacity] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${tasksOpen ? "w-72 opacity-100 max-md:h-80 max-md:w-full" : "w-0 opacity-0 max-md:h-0 max-md:w-full"}`}
        >
          <aside
            id="day-task-panel"
            className="bg-muted/20 flex min-h-0 min-w-72 flex-1 flex-col border-r max-md:min-w-0"
          >
            <div className="flex shrink-0 items-start justify-between gap-2 border-b px-4 py-3">
              <div>
                <h2 className="font-semibold">{m.planning_tasks()}</h2>
                <p className="text-muted-foreground text-xs">
                  {m.planning_active_tasks_hint()}
                </p>
              </div>
            </div>
            <div className="shrink-0 px-3 pt-3">
              <Input
                type="search"
                aria-label={m.planning_search_tasks()}
                placeholder={m.planning_search_tasks()}
                maxLength={256}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <p className="text-muted-foreground py-2 text-xs">
                {m.planning_drag_hint()}
              </p>
            </div>
            <div
              className="flex min-h-0 flex-1 flex-col p-3 pt-0"
              aria-busy={
                status === "LoadingFirstPage" || status === "LoadingMore"
              }
            >
              {status === "LoadingFirstPage" && (
                <p
                  role="status"
                  className="text-sm"
                >
                  {m.planning_loading_tasks()}
                </p>
              )}
              {!tasks.length && status === "Exhausted" && (
                <p className="text-sm">
                  {searchText
                    ? m.planning_no_search_results()
                    : m.planning_no_unscheduled()}
                </p>
              )}
              <VirtualList
                key={`${day}:${searchText}`}
                items={tasks}
                className="min-h-0 flex-1 overflow-x-hidden overscroll-contain"
                estimateSize={() => 176}
                overscan={5}
                enabled={tasksOpen}
                getItemKey={(index) => tasks[index]!._id}
                onEndReached={
                  status === "CanLoadMore" ? () => loadMore(30) : undefined
                }
                renderItem={(task) => {
                  const planned = sessions
                    .filter(
                      (s) =>
                        s.taskId === task._id ||
                        (task.recurring &&
                          s.seriesId === task._id &&
                          s.startAt < end &&
                          s.endAt > start)
                    )
                    .reduce((n, s) => n + (s.endAt - s.startAt) / MINUTE, 0);
                  const remaining = Math.max(
                    0,
                    (task.effortMinutes ?? 45) - planned
                  );
                  const missingMinutes =
                    dayPlan?.shortfalls.find(
                      (shortfall) =>
                        shortfall.taskId === task._id && shortfall.minutes > 0
                    )?.minutes ?? Math.max(0, remaining - free);
                  return (
                    <div
                      key={task._id}
                      className="relative"
                      onPointerEnter={() => setHighlightedTaskId(task._id)}
                      onPointerLeave={(e) => {
                        if (!e.currentTarget.contains(document.activeElement))
                          setHighlightedTaskId(null);
                      }}
                      onFocusCapture={() => setHighlightedTaskId(task._id)}
                      onBlurCapture={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget))
                          setHighlightedTaskId(null);
                      }}
                    >
                      <button
                        className="bg-background hover:border-primary/50 h-[168px] w-full touch-none overflow-hidden rounded-lg border p-3 pr-10 text-left"
                        onPointerDown={(e) => begin(e, task._id, "new")}
                        onClick={(e) =>
                          handleCalendarClick(e, () => openTask(task._id))
                        }
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical
                            size={14}
                            className="text-muted-foreground mt-1 shrink-0"
                          />
                          <span className="line-clamp-2 text-sm font-medium">
                            {task.title}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-2 text-xs">
                          {m.planning_planned({ minutes: Math.round(planned) })}{" "}
                          ·{" "}
                          {m.planning_session_count({
                            count: sessions.filter(
                              (s) =>
                                s.taskId === task._id ||
                                (task.recurring &&
                                  s.seriesId === task._id &&
                                  s.startAt < end &&
                                  s.endAt > start)
                            ).length,
                          })}{" "}
                          ·{" "}
                          {
                            {
                              low: m.planning_low(),
                              normal: m.planning_normal(),
                              high: m.planning_high(),
                              critical: m.planning_critical(),
                            }[task.priority ?? "normal"]
                          }
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {task.effortMinutes === undefined
                            ? m.planning_effort_unknown()
                            : m.planning_effort_minutes({
                                minutes: task.effortMinutes,
                              })}
                        </p>
                        {task.recurring && (
                          <p className="text-muted-foreground text-xs">
                            {m.recurrence_title()}
                          </p>
                        )}
                        {task.automaticSchedulingPaused && (
                          <p className="text-muted-foreground text-xs">
                            {m.planning_automatic_paused()}
                          </p>
                        )}
                        {planned === 0 && (
                          <p className="text-muted-foreground text-xs">
                            {m.planning_unscheduled()}
                          </p>
                        )}
                        {missingMinutes > 0 && (
                          <p
                            role="status"
                            className="mt-1 text-xs"
                          >
                            {m.planning_shortfall({
                              minutes: Math.ceil(missingMinutes),
                            })}
                          </p>
                        )}
                      </button>
                      <div
                        className="absolute right-1 top-1"
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <ActionMenu>
                          <DropdownMenuItem
                            disabled={
                              scheduleTask.isPending ||
                              task.effortMinutes === undefined
                            }
                            onSelect={() =>
                              scheduleTask.mutate({
                                taskId: task._id,
                                date: day,
                                timezone,
                              })
                            }
                          >
                            <RefreshCw />
                            {m.planning_schedule_task()}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              openDialog(
                                <TaskDeleteDialog taskIds={[task._id]} />
                              )
                            }
                          >
                            <Trash2 />
                            {m.delete()}
                          </DropdownMenuItem>
                        </ActionMenu>
                      </div>
                    </div>
                  );
                }}
              />
              {status === "LoadingMore" && (
                <p
                  role="status"
                  className="py-2 text-xs"
                >
                  {m.planning_loading_tasks()}
                </p>
              )}
            </div>
            <details
              className="max-h-1/2 shrink-0 overflow-auto border-t px-3 text-sm"
              open={
                planningError ||
                replan.error ||
                scheduleTask.error ||
                undo.error
                  ? true
                  : undefined
              }
            >
              <summary className="cursor-pointer py-2 font-medium">
                {m.planning_status()}
              </summary>
              <div
                className="space-y-2 pb-3"
                aria-live="polite"
              >
                <details>
                  <summary>{m.planning_about_automatic()}</summary>
                  <p>{m.planning_automatic_hint()}</p>
                </details>
                {planningError && <p role="alert">{planningError}</p>}
                {scheduleTask.error && (
                  <p role="alert">{scheduleTask.error.message}</p>
                )}
                {replan.error && <p role="alert">{replan.error.message}</p>}
                {undo.error && <p role="alert">{undo.error.message}</p>}
                {!!dayPlan?.changes.length && (
                  <details>
                    <summary>
                      {m.planning_automatic_changes({
                        count: dayPlan.changes.length,
                      })}
                    </summary>
                    <ul>
                      {dayPlan.changes.map((change) => (
                        <li key={change.sessionId}>
                          {change.title}: {change.reason}
                          {change.before && (
                            <>
                              {" "}
                              · {localDateTime(change.before.startAt, timezone)}
                              –{clock(change.before.endAt)}
                            </>
                          )}
                          {" → "}
                          {change.after ? (
                            <>
                              {localDateTime(change.after.startAt, timezone)}–
                              {clock(change.after.endAt)}
                            </>
                          ) : (
                            m.planning_unschedule_session()
                          )}
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant="outline"
                      disabled={undo.isPending}
                      onClick={() => undo.mutate({})}
                    >
                      {m.planning_undo_plan()}
                    </Button>
                  </details>
                )}
                {!!dayPlan?.shortfalls.length && (
                  <details open>
                    <summary>{m.planning_shortfalls()}</summary>
                    <ul>
                      {dayPlan.shortfalls.map((shortfall) => (
                        <li key={shortfall.taskId}>
                          {shortfall.title}:{" "}
                          {shortfall.minutes > 0 && (
                            <>{shortfall.minutes} min · </>
                          )}
                          {shortfall.reason}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {dayPlan?.conflicts.map((conflict) => (
                  <p
                    key={conflict}
                    role="alert"
                  >
                    {conflict}
                  </p>
                ))}
              </div>
            </details>
            <details
              className="max-h-1/2 shrink-0 overflow-auto border-t px-3"
              onToggle={(e) => setTrackingOpen(e.currentTarget.open)}
            >
              <summary className="cursor-pointer py-2 text-sm">
                {m.planning_tracking()}
              </summary>
              <div className="min-w-0 pt-2">{trackingOpen && <TaskCard />}</div>
            </details>
          </aside>
        </div>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              className="flex min-h-0 flex-1 flex-col"
              inert={reviewOpen}
              aria-hidden={reviewOpen}
            >
              {(interactionError || save.error) && (
                <p
                  role="alert"
                  className="shrink-0 border-b px-4 py-2 text-sm"
                >
                  {interactionError
                    ? `${m.constraints_conflicts()}: ${interactionError}`
                    : save.error?.message}
                </p>
              )}
              {!constraints.available.length && (
                <p className="px-4 py-2 text-sm">{m.constraints_closed()}</p>
              )}
              <div
                ref={scroll}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
                role="region"
                aria-label={m.planning_sessions()}
                tabIndex={0}
              >
                <div
                  ref={surface}
                  className="relative ml-28 mr-4"
                  style={{ height: dayMinutes * PX }}
                >
                  {constraints.available
                    .filter(
                      (window) =>
                        window.startAt !== start || window.endAt !== end
                    )
                    .map((window, index) => (
                      <div
                        key={`available-${index}`}
                        className="pointer-events-none absolute inset-x-0 border-l-4 border-emerald-500 bg-emerald-500/10"
                        style={{
                          top: ((window.startAt - start) / MINUTE) * PX,
                          height:
                            ((window.endAt - window.startAt) / MINUTE) * PX,
                        }}
                      >
                        <span className="text-xs">
                          {m.constraints_availability()}
                        </span>
                      </div>
                    ))}
                  {constraints.protected.map((window, index) => (
                    <div
                      key={`protected-${index}`}
                      className="pointer-events-none absolute inset-x-0 border-2 border-dashed border-amber-600 bg-amber-500/15"
                      style={{
                        top: ((window.startAt - start) / MINUTE) * PX,
                        height: ((window.endAt - window.startAt) / MINUTE) * PX,
                      }}
                    >
                      <span className="text-xs">
                        {m.constraints_protected_label()}
                      </span>
                    </div>
                  ))}
                  {Array.from(
                    { length: Math.ceil(dayMinutes / 15) },
                    (_, i) => (
                      <div
                        key={i}
                        className={`pointer-events-none absolute left-0 right-0 border-t ${i % 4 === 0 ? "border-border" : "border-border/35 border-dashed"}`}
                        style={{ top: i * 15 * PX }}
                      >
                        {i % 4 === 0 && (
                          <span className="text-muted-foreground absolute -left-28 -top-2 w-24 text-right text-xs">
                            {clock(start + i * 15 * MINUTE)}
                          </span>
                        )}
                      </div>
                    )
                  )}
                  {now >= start && now < end && (
                    <div
                      className="pointer-events-none absolute left-0 right-0 z-10 border-t border-rose-500"
                      style={{ top: ((now - start) / MINUTE) * PX }}
                    >
                      <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-rose-500" />
                    </div>
                  )}
                  {rendered.map((session) => {
                    const pos = positions.get(session._id)!;
                    const active =
                      session._id === "preview" ||
                      overlay?.sessionId === session._id;
                    const canEdit = session.taskCompletedAt === undefined;
                    const compact =
                      (session.endAt - session.startAt) / MINUTE < 15;
                    const conflicts = placementConflicts(
                      session,
                      settings,
                      events
                    );
                    const placement = {
                      taskId: session.taskId,
                      sessionId:
                        session._id === "preview"
                          ? undefined
                          : (session._id as Id<"sessions">),
                      startAt: session.startAt,
                      endAt: session.endAt,
                    };
                    return (
                      <Tooltip
                        key={session._id}
                        content={
                          <div>
                            <p className="font-semibold">{session.taskTitle}</p>
                            <p>
                              {clock(session.startAt)}–{clock(session.endAt)} ·{" "}
                              {Math.round(
                                (session.endAt - session.startAt) / MINUTE
                              )}{" "}
                              {m.planning_minutes()}
                            </p>
                          </div>
                        }
                      >
                        <div
                          className={`border-primary/35 bg-accent text-accent-foreground absolute overflow-hidden rounded-md border ${active || highlightedTaskId === session.taskId ? "ring-primary z-20 ring-2" : "z-[1]"}`}
                          style={{
                            top:
                              ((Math.max(start, session.startAt) - start) /
                                MINUTE) *
                              PX,
                            height: Math.max(
                              8,
                              ((Math.min(end, session.endAt) -
                                Math.max(start, session.startAt)) /
                                MINUTE) *
                                PX
                            ),
                            left: `calc(${(pos.lane / pos.lanes) * 100}% + 3px)`,
                            width: `calc(${100 / pos.lanes}% - 6px)`,
                          }}
                        >
                          {canEdit && !compact && session._id !== "preview" && (
                            <button
                              aria-label={m.planning_resize_start({
                                title: session.taskTitle,
                              })}
                              className="absolute left-0 right-0 top-0 z-10 flex h-2 cursor-ns-resize touch-none items-center justify-center"
                              onPointerDown={(e) =>
                                begin(
                                  e,
                                  session.taskId,
                                  "start",
                                  session as CalendarSession
                                )
                              }
                              onClick={(e) =>
                                handleCalendarClick(e, () => inspect(placement))
                              }
                            >
                              <span className="h-0.5 w-6 rounded bg-current opacity-40" />
                            </button>
                          )}
                          <button
                            aria-label={`${session.taskTitle}, ${clock(session.startAt)}–${clock(session.endAt)}`}
                            className={`block h-full w-full touch-none px-2 ${compact ? "py-0" : "py-0.5"} text-left ${canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                            onPointerDown={(e) => {
                              if (session._id !== "preview")
                                begin(
                                  e,
                                  session.taskId,
                                  "move",
                                  session as CalendarSession
                                );
                            }}
                            onClick={(e) =>
                              handleCalendarClick(e, () => inspect(placement))
                            }
                          >
                            {!compact && (
                              <p className="truncate text-xs font-semibold">
                                {session.taskTitle}
                              </p>
                            )}
                            {!compact &&
                              ((session.endAt - session.startAt) / MINUTE) *
                                PX >=
                                40 && (
                                <p className="truncate text-[11px] opacity-75">
                                  {clock(session.startAt)}–
                                  {clock(session.endAt)} ·{" "}
                                  {Math.round(
                                    (session.endAt - session.startAt) / MINUTE
                                  )}
                                  m
                                </p>
                              )}
                            {!compact && !!conflicts.length && (
                              <p
                                role="status"
                                className="text-xs font-semibold"
                              >
                                {m.constraints_conflicts()}:{" "}
                                {conflicts.join("; ")}
                              </p>
                            )}
                          </button>
                          {canEdit && !compact && session._id !== "preview" && (
                            <button
                              aria-label={m.planning_resize_end({
                                title: session.taskTitle,
                              })}
                              className="absolute bottom-0 left-0 right-0 z-10 flex h-2 cursor-ns-resize touch-none items-center justify-center"
                              onPointerDown={(e) =>
                                begin(
                                  e,
                                  session.taskId,
                                  "end",
                                  session as CalendarSession
                                )
                              }
                              onClick={(e) =>
                                handleCalendarClick(e, () => inspect(placement))
                              }
                            >
                              <span className="h-0.5 w-6 rounded bg-current opacity-40" />
                            </button>
                          )}
                        </div>
                      </Tooltip>
                    );
                  })}
                  {dayEvents.map((event) => {
                    const pos = positions.get(event._id)!;
                    return (
                      <button
                        key={event._id}
                        className="bg-muted absolute z-[2] overflow-auto rounded border-2 border-dashed p-2 text-left text-xs"
                        onClick={() => editEvent(event)}
                        style={{
                          top:
                            ((Math.max(start, event.startAt) - start) /
                              MINUTE) *
                            PX,
                          height:
                            ((Math.min(end, event.endAt) -
                              Math.max(start, event.startAt)) /
                              MINUTE) *
                            PX,
                          left: `calc(${(pos.lane / pos.lanes) * 100}% + 3px)`,
                          width: `calc(${100 / pos.lanes}% - 6px)`,
                        }}
                      >
                        <p className="font-semibold">
                          {event.attention === "focused"
                            ? m.constraints_focused()
                            : m.constraints_background()}
                          : {event.title}
                        </p>
                        <p>
                          {clock(event.startAt)}–{clock(event.endAt)}
                        </p>
                        {!!eventConflicts(event).length && (
                          <p role="status">
                            {m.constraints_conflicts()}:{" "}
                            {eventConflicts(event).join(", ")}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div
              inert={!reviewOpen}
              aria-hidden={!reviewOpen}
              className={`bg-background absolute inset-0 z-30 flex min-h-0 flex-col transition-[translate,opacity] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${reviewOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"}`}
            >
              <SessionReviewPanel
                sessions={sessions}
                timezone={timezone}
                now={now}
                onClose={() => setReviewOpen(false)}
              />
            </div>
          </div>
          {sessions.length > 0 && (
            <SessionCheckInTray
              sessions={pendingCheckIns}
              timezone={timezone}
              onReview={() => setReviewOpen((open) => !open)}
              reviewOpen={reviewOpen}
            />
          )}
        </section>
      </div>
      {drag?.moved && (
        <div
          className="bg-foreground text-background pointer-events-none fixed z-50 rounded px-3 py-2 text-xs"
          style={{ left: drag.x + 16, top: drag.y + 16 }}
        >
          {drag.valid
            ? `${clock(drag.startAt)}–${clock(drag.endAt)}`
            : m.planning_drop_hint()}
        </div>
      )}
    </div>
  );
}

function SessionDetails({ placement }: { placement: Placement }) {
  const { data: task } = useSuspenseQuery(
    convexQuery(api.tasks.getExtendedById, { taskId: placement.taskId })
  );
  const { data: sessions } = useSuspenseQuery(
    convexQuery(api.sessions.listSessions, {})
  );
  const { data: settings } = useSuspenseQuery(
    convexQuery(api.planning.getSettings, {})
  );
  const { data: events } = useSuspenseQuery(
    convexQuery(api.planning.listEvents, {})
  );
  const timezone =
    settings?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const originalLocal = localDateTime(placement.startAt, timezone);
  const [date, setDate] = useState(originalLocal.slice(0, 10));
  const [time, setTime] = useState(originalLocal.slice(11));
  const [duration, setDuration] = useState(
    Math.ceil((placement.endAt - placement.startAt) / MINUTE)
  );
  const [allowOverlap, setAllowOverlap] = useState(false);
  const originalSession = sessions.find((s) => s._id === placement.sessionId);
  const [pinned, setPinned] = useState(originalSession?.pinned ?? false);
  const { openDrawer, closeDrawer } = useModal();
  const save = useMutation({
    mutationFn: useConvexMutation(api.sessions.saveSession),
    onSuccess: () => closeDrawer(),
  });
  const unschedule = useMutation({
    mutationFn: useConvexMutation(api.sessions.unscheduleSession),
    onSuccess: () => closeDrawer(),
  });
  const requestCheckIn = useMutation({
    mutationFn: useConvexMutation(api.sessions.requestCheckIn),
    onSuccess: () =>
      openDrawer(<CheckInDrawer sessionId={placement.sessionId!} />),
  });
  let startAt = NaN;
  let timeError = "";
  try {
    startAt =
      `${date}T${time}` === originalLocal
        ? placement.startAt
        : zonedInstant(`${date}T${time}`, timezone);
  } catch (error) {
    timeError =
      error instanceof Error ? error.message : m.planning_save_failed();
  }
  const endAt = startAt + duration * MINUTE;
  const reasons = Number.isFinite(startAt)
    ? placementConflicts({ startAt, endAt }, settings, events)
    : [];
  const conflict =
    !!reasons.length ||
    sessions.some(
      (s) =>
        s._id !== placement.sessionId && s.startAt < endAt && s.endAt > startAt
    );
  return (
    <>
      <form
        id="day-session-form"
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({
            taskId: task._id,
            sessionId: placement.sessionId,
            startAt,
            endAt,
            allowConflict: allowOverlap,
            pinned,
          });
        }}
      >
        <h3 className="font-medium">{task.title}</h3>
        <TaskProgress taskId={task._id} />
        {import.meta.env.DEV &&
          originalSession &&
          originalSession.startAt > Date.now() &&
          originalSession.checkInRequestedAt === undefined &&
          !originalSession.checkIn &&
          task.completedAt === undefined && (
            <Button
              type="button"
              variant="outline"
              disabled={requestCheckIn.isPending}
              onClick={() =>
                requestCheckIn.mutate({ sessionId: originalSession._id })
              }
            >
              {m.check_in_trigger_dev()}
            </Button>
          )}
        {requestCheckIn.error && (
          <p role="alert">{requestCheckIn.error.message}</p>
        )}
        {originalSession &&
          (originalSession.startAt <= Date.now() ||
            originalSession.checkInRequestedAt !== undefined) && (
            <section
              aria-label={m.check_in_title()}
              className="bg-muted/30 space-y-3 rounded-lg border p-3"
            >
              <h3 className="text-sm font-semibold">{m.check_in_title()}</h3>
              <SessionCheckIn session={originalSession} />
            </section>
          )}
        {originalSession?.automaticReason && (
          <p className="text-sm">{originalSession.automaticReason}</p>
        )}
        <label className="text-sm">
          <Checkbox
            checked={pinned}
            onCheckedChange={(value) => setPinned(value === true)}
          />{" "}
          {m.planning_pin_session()}
        </label>
        <p className="text-xs">{timezone}</p>
        {timeError && <p role="alert">{timeError}</p>}
        {!!reasons.length && (
          <p role="alert">
            {m.constraints_conflicts()}: {reasons.join("; ")}
          </p>
        )}
        {!!task.completedAt && (
          <p className="text-muted-foreground text-sm">
            {m.planning_task_completed()}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => openDrawer(<TaskEditDrawer editedTask={task} />)}
        >
          {m.planning_edit_task()}
        </Button>
        <label className="text-sm">
          {m.planning_date()}
          <PlanningDatePicker
            value={date}
            onChange={(value) => {
              setDate(value);
              setAllowOverlap(false);
            }}
          />
        </label>
        <label className="text-sm">
          {m.planning_start()}
          <PlanningTimePicker
            label={m.planning_start()}
            value={time}
            onChange={(value) => {
              setTime(value);
              setAllowOverlap(false);
            }}
          />
        </label>
        <label className="text-sm">
          {m.planning_minutes()}
          <Input
            type="number"
            min={1}
            required
            value={duration}
            onChange={(e) => {
              setDuration(Number(e.target.value));
              setAllowOverlap(false);
            }}
          />
        </label>
        <p className="text-muted-foreground text-xs">
          {m.planning_unscheduled_hint()}
        </p>
        {conflict && (
          <label className="text-sm">
            <Checkbox
              checked={allowOverlap}
              onCheckedChange={(checked) => setAllowOverlap(checked === true)}
            />{" "}
            {m.constraints_allow_placement()}
          </label>
        )}
        {placement.sessionId && (
          <Button
            type="button"
            variant="outline"
            disabled={unschedule.isPending || save.isPending}
            onClick={() =>
              unschedule.mutate({ sessionId: placement.sessionId! })
            }
          >
            {m.planning_unschedule_session()}
          </Button>
        )}
        {unschedule.isError && <p role="alert">{m.planning_save_failed()}</p>}
        {save.isError && <p role="alert">{m.planning_save_failed()}</p>}
      </form>
      <Drawer.Footer>
        <Button
          type="submit"
          form="day-session-form"
          disabled={
            save.isPending ||
            unschedule.isPending ||
            !!task.completedAt ||
            !Number.isFinite(startAt) ||
            duration <= 0 ||
            (conflict && !allowOverlap)
          }
        >
          {m.save()}
          <StatusSpinner
            status={
              save.isPending ? "pending" : save.isError ? "error" : "idle"
            }
          />
        </Button>
      </Drawer.Footer>
    </>
  );
}

function DayTaskDetails({ taskId }: { taskId: Id<"tasks"> }) {
  const { data: task } = useSuspenseQuery(
    convexQuery(api.tasks.getExtendedById, { taskId })
  );
  return <TaskEditDrawer editedTask={task} />;
}
