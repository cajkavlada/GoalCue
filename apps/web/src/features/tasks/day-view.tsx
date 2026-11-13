import { useCallback, useEffect, useRef, useState } from "react";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from "lucide-react";

import { api } from "@gc/convex/api";
import { Doc, Id } from "@gc/convex/types";
import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { Button, Drawer, DrawerButton, Input, useModal } from "@gc/ui";

import {
  adjustSession,
  freeDayMinutes,
  layoutSessions,
  MINUTE,
  PIXELS_PER_MINUTE as PX,
  snapMinutes,
} from "./day-calendar-layout";
import { TaskCard } from "./task-card";
import { TaskCreateDrawer } from "./task-create-drawer";
import { TaskEditDrawer } from "./task-edit-drawer";
import { taskApi } from "./task.api";

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
};

export function DayView() {
  const [day, setDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const [tasksOpen, setTasksOpen] = useState(true);
  const [drag, setDrag] = useState<Gesture | null>(null);
  const [pending, setPending] = useState<Placement | null>(null);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const { data: tasks } = taskApi.useUncompletedExtendedList();
  const { data: sessions } = useSuspenseQuery(
    convexQuery(api.sessions.listSessions, {})
  );
  const save = useMutation({
    mutationFn: useConvexMutation(api.sessions.saveSession),
  });
  const { openDrawer } = useModal();
  const scroll = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const start = new Date(`${day}T00:00`).getTime();
  const end = addDays(new Date(start), 1).getTime();
  const dayMinutes = (end - start) / MINUTE;
  const today = sessions.filter((s) => s.startAt < end && s.endAt > start);
  const free = freeDayMinutes(today, start, end);

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
      const conflict = sessions.some(
        (s) =>
          s._id !== placement.sessionId &&
          s.startAt < placement.endAt &&
          s.endAt > placement.startAt
      );
      if (conflict) {
        inspect(placement);
        return;
      }
      setPending(placement);
      save.mutate(placement, {
        onSuccess: () => setMessage(m.planning_saved()),
        onError: () => setMessage(m.planning_save_failed()),
        onSettled: () => setPending(null),
      });
    },
    [sessions, inspect, save]
  );
  const handlers = useRef({ inspect, commit });
  useEffect(() => {
    handlers.current = { inspect, commit };
  }, [inspect, commit]);
  useEffect(() => {
    setMessage("");
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
      const placement = {
        taskId: current.taskId,
        sessionId: current.sessionId,
        startAt: current.startAt,
        endAt: current.endAt,
      };
      if (current.moved && current.valid) handlers.current.commit(placement);
      else if (!current.moved) handlers.current.inspect(placement);
    };
    const cancel = () => {
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
    session?: Doc<"sessions">
  ) {
    if (e.button !== 0 || save.isPending) return;
    const task = tasks.find((t) => t._id === taskId);
    const placement = {
      taskId,
      sessionId: session?._id,
      startAt: session?.startAt ?? start + 9 * 60 * MINUTE,
      endAt:
        session?.endAt ??
        start + (9 * 60 + Math.min(task?.effortMinutes ?? 45, 45)) * MINUTE,
    };
    if (session && (session.startAt < start || session.endAt > end || !task)) {
      inspect(placement);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
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
    };
    pointer.current = { x: e.clientX, y: e.clientY };
    gesture.current = next;
    setDrag(next);
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
          },
        ]
    : today;
  const positions = layoutSessions(rendered);

  return (
    <div className="bg-background flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-3">
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
        <h1 className="mr-auto text-lg font-semibold">{m.planning_day()}</h1>
        <Button
          size="icon"
          variant="outline"
          aria-label={m.planning_previous()}
          onClick={() =>
            setDay(format(addDays(new Date(start), -1), "yyyy-MM-dd"))
          }
        >
          <ChevronLeft />
        </Button>
        <Input
          className="w-auto"
          aria-label={m.planning_displayed_day()}
          type="date"
          required
          value={day}
          onChange={(e) => {
            if (e.target.value) setDay(e.target.value);
          }}
        />
        <Button
          size="icon"
          variant="outline"
          aria-label={m.planning_next()}
          onClick={() =>
            setDay(format(addDays(new Date(start), 1), "yyyy-MM-dd"))
          }
        >
          <ChevronRight />
        </Button>
      </header>
      {message && (
        <p
          role="status"
          className="shrink-0 border-b px-4 py-2 text-sm"
        >
          {message}
        </p>
      )}
      <div className="flex min-h-0 flex-1 max-md:flex-col">
        <div
          aria-hidden={!tasksOpen}
          inert={!tasksOpen}
          className={`flex min-h-0 shrink-0 flex-col overflow-hidden transition-[width,height,opacity] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${tasksOpen ? "w-72 opacity-100 max-md:h-56 max-md:w-full" : "w-0 opacity-0 max-md:h-0 max-md:w-full"}`}
        >
          <aside
            id="day-task-panel"
            className="bg-muted/20 flex min-h-0 min-w-72 flex-1 flex-col border-r max-md:min-w-0"
          >
            <div className="flex shrink-0 items-start justify-between gap-2 border-b px-4 py-3">
              <div>
                <h2 className="font-semibold">{m.planning_tasks()}</h2>
                <p className="text-muted-foreground text-xs">
                  {m.planning_drag_hint()}
                </p>
              </div>
              <DrawerButton
                drawerContent={<TaskCreateDrawer />}
                size="icon"
                tooltip={m.planning_create_task()}
                aria-label={m.planning_create_task()}
              >
                <Plus />
              </DrawerButton>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden overscroll-contain p-3">
              {!tasks.length && (
                <p className="text-sm">{m.planning_no_unscheduled()}</p>
              )}
              {tasks.map((task) => {
                const planned = sessions
                  .filter((s) => s.taskId === task._id)
                  .reduce((n, s) => n + (s.endAt - s.startAt) / MINUTE, 0);
                const remaining = Math.max(
                  0,
                  (task.effortMinutes ?? 45) - planned
                );
                const placement = {
                  taskId: task._id,
                  startAt: start + 9 * 60 * MINUTE,
                  endAt:
                    start +
                    (9 * 60 + Math.min(task.effortMinutes ?? 45, 45)) * MINUTE,
                };
                return (
                  <button
                    key={task._id}
                    className="bg-background hover:border-primary/50 w-full touch-none rounded-lg border p-3 text-left"
                    onPointerDown={(e) => begin(e, task._id, "new")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        inspect(placement);
                      }
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical
                        size={14}
                        className="text-muted-foreground mt-1 shrink-0"
                      />
                      <span className="text-sm font-medium">{task.title}</span>
                    </div>
                    <p className="text-muted-foreground mt-2 text-xs">
                      {m.planning_planned({ minutes: Math.round(planned) })} ·{" "}
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
                    {planned === 0 && (
                      <p className="text-muted-foreground text-xs">
                        {m.planning_unscheduled()}
                      </p>
                    )}
                    {remaining > free && (
                      <p
                        role="status"
                        className="mt-1 text-xs"
                      >
                        {m.planning_shortfall({
                          minutes: Math.ceil(remaining - free),
                        })}
                      </p>
                    )}
                  </button>
                );
              })}
              <details>
                <summary className="cursor-pointer py-2 text-sm">
                  {m.planning_tracking()}
                </summary>
                <div className="min-w-0 pt-2">
                  <TaskCard />
                </div>
              </details>
            </div>
          </aside>
        </div>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            ref={scroll}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            role="region"
            aria-label={m.planning_sessions()}
            tabIndex={0}
          >
            <div
              ref={surface}
              className="relative ml-16 mr-4"
              style={{ height: dayMinutes * PX }}
            >
              {Array.from({ length: Math.ceil(dayMinutes / 15) }, (_, i) => (
                <div
                  key={i}
                  className={`pointer-events-none absolute left-0 right-0 border-t ${i % 4 === 0 ? "border-border" : "border-border/35 border-dashed"}`}
                  style={{ top: i * 15 * PX }}
                >
                  {i % 4 === 0 && (
                    <span className="text-muted-foreground absolute -left-14 -top-2 w-11 text-right text-xs">
                      {format(start + i * 15 * MINUTE, "HH:mm")}
                    </span>
                  )}
                </div>
              ))}
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
                const task = tasks.find((t) => t._id === session.taskId);
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
                  <div
                    key={session._id}
                    className={`border-primary/35 bg-accent text-accent-foreground absolute overflow-hidden rounded-md border ${active ? "ring-primary z-20 ring-2" : "z-[1]"}`}
                    style={{
                      top:
                        ((Math.max(start, session.startAt) - start) / MINUTE) *
                        PX,
                      height:
                        ((Math.min(end, session.endAt) -
                          Math.max(start, session.startAt)) /
                          MINUTE) *
                        PX,
                      left: `calc(${(pos.lane / pos.lanes) * 100}% + 3px)`,
                      width: `calc(${100 / pos.lanes}% - 6px)`,
                    }}
                  >
                    {task && session._id !== "preview" && (
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
                            session as Doc<"sessions">
                          )
                        }
                        onClick={(e) => {
                          if (e.detail === 0) inspect(placement);
                        }}
                      >
                        <span className="h-0.5 w-6 rounded bg-current opacity-40" />
                      </button>
                    )}
                    <button
                      className="h-full w-full cursor-grab touch-none px-2 py-2 text-left active:cursor-grabbing"
                      onPointerDown={(e) => {
                        if (session._id !== "preview")
                          begin(
                            e,
                            session.taskId,
                            "move",
                            session as Doc<"sessions">
                          );
                      }}
                      onClick={(e) => {
                        if (e.detail === 0) inspect(placement);
                      }}
                    >
                      <p className="truncate text-xs font-semibold">
                        {session.taskTitle}
                      </p>
                      <p className="truncate text-[11px] opacity-75">
                        {format(session.startAt, "HH:mm")}–
                        {format(session.endAt, "HH:mm")} ·{" "}
                        {Math.round((session.endAt - session.startAt) / MINUTE)}
                        m
                      </p>
                    </button>
                    {task && session._id !== "preview" && (
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
                            session as Doc<"sessions">
                          )
                        }
                        onClick={(e) => {
                          if (e.detail === 0) inspect(placement);
                        }}
                      >
                        <span className="h-0.5 w-6 rounded bg-current opacity-40" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
      {drag?.moved && (
        <div
          className="bg-foreground text-background pointer-events-none fixed z-50 rounded px-3 py-2 text-xs"
          style={{ left: drag.x + 16, top: drag.y + 16 }}
        >
          {drag.valid
            ? `${format(drag.startAt, "HH:mm")}–${format(drag.endAt, "HH:mm")}`
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
  const [date, setDate] = useState(format(placement.startAt, "yyyy-MM-dd"));
  const [time, setTime] = useState(format(placement.startAt, "HH:mm"));
  const [duration, setDuration] = useState(
    (placement.endAt - placement.startAt) / MINUTE
  );
  const [allowOverlap, setAllowOverlap] = useState(false);
  const { openDrawer, closeDrawer } = useModal();
  const save = useMutation({
    mutationFn: useConvexMutation(api.sessions.saveSession),
    onSuccess: () => closeDrawer(),
  });
  const unschedule = useMutation({
    mutationFn: useConvexMutation(api.sessions.unscheduleSession),
    onSuccess: () => closeDrawer(),
  });
  const originalDate = format(placement.startAt, "yyyy-MM-dd");
  const originalTime = format(placement.startAt, "HH:mm");
  const startAt =
    date === originalDate && time === originalTime
      ? placement.startAt
      : new Date(`${date}T${time}`).getTime();
  const endAt = startAt + duration * MINUTE;
  const conflict = sessions.some(
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
          });
        }}
      >
        <h3 className="font-medium">{task.title}</h3>
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
          <Input
            type="date"
            required
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setAllowOverlap(false);
            }}
          />
        </label>
        <label className="text-sm">
          {m.planning_start()}
          <Input
            type="time"
            required
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
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
            <input
              type="checkbox"
              checked={allowOverlap}
              onChange={(e) => setAllowOverlap(e.target.checked)}
            />{" "}
            {m.planning_allow_overlap()}
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
        </Button>
      </Drawer.Footer>
    </>
  );
}
