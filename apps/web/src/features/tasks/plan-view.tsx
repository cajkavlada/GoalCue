import { useState } from "react";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { addMonths, format } from "date-fns";
import { cs, enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { api } from "@gc/convex/api";
import { m } from "@gc/i18n/messages";
import { getLocale } from "@gc/i18n/runtime";
import { ErrorSuspense } from "@gc/react-kit";
import {
  Button,
  Calendar,
  CalendarDayButton,
  Drawer,
  DrawerButton,
  Select,
  useModal,
} from "@gc/ui";
import {
  availabilityOn,
  dayBounds,
  localDateTime,
  shiftDate,
} from "@gc/validators";

import { layoutSessions } from "./day-calendar-layout";
import { DayView, SessionDetails } from "./day-view";
import { ProjectCreateDrawer, ProjectsView } from "./projects";
import { EventDetails, PlanningDatePicker } from "./schedule-constraints";
import { TaskCreateDrawer } from "./task-create-drawer";

const planningRoute = getRouteApi("/{-$locale}/_protected/dashboard");

export function PlanView({
  view,
}: {
  view: "day" | "week" | "month" | "projects";
}) {
  const { date } = planningRoute.useSearch();
  const navigate = useNavigate({ from: `/{-$locale}/dashboard/${view}` });
  const { data: settings } = useSuspenseQuery(
    convexQuery(api.planning.getSettings, {})
  );
  const timezone =
    settings?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = localDateTime(Date.now(), timezone).slice(0, 10);
  const day = date ?? today;
  const weekStartsOn = settings?.weekStartsOn ?? 1;
  const currentRange =
    view === "month"
      ? day.slice(0, 7) === today.slice(0, 7)
      : view === "week"
        ? shiftDate(
            day,
            -((new Date(day + "T12:00Z").getUTCDay() - weekStartsOn + 7) % 7)
          ) ===
          shiftDate(
            today,
            -((new Date(today + "T12:00Z").getUTCDay() - weekStartsOn + 7) % 7)
          )
        : day === today;
  const setDay = (date: string) => {
    void navigate({
      to: `/{-$locale}/dashboard/${view}`,
      search: { date },
    });
  };
  const shiftPeriod = (direction: number) =>
    setDay(
      view === "month"
        ? format(
            addMonths(new Date(`${day}T12:00:00`), direction),
            "yyyy-MM-dd"
          )
        : shiftDate(day, direction * (view === "day" ? 1 : 7))
    );
  return (
    <>
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-end gap-2">
          <Button
            size="icon"
            variant="outline"
            aria-label={m.planning_previous()}
            onClick={() => shiftPeriod(-1)}
          >
            <ChevronLeft />
          </Button>
          <div className="w-48">
            <PlanningDatePicker
              label={m.plan_selected_date()}
              value={day}
              onChange={setDay}
            />
          </div>
          <Button
            size="icon"
            variant="outline"
            aria-label={m.planning_next()}
            onClick={() => shiftPeriod(1)}
          >
            <ChevronRight />
          </Button>
          {view !== "projects" && !currentRange && (
            <Button
              variant="outline"
              onClick={() => setDay(today)}
            >
              {m.check_in_today()}
            </Button>
          )}
          <span className="text-muted-foreground hidden pb-2 text-xs lg:inline">
            {timezone}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DrawerButton
            variant="outline"
            aria-label={m.planning_create_task()}
            drawerContent={<TaskCreateDrawer />}
          >
            <Plus />
            {m.plan_task()}
          </DrawerButton>
          <DrawerButton
            variant="outline"
            aria-label={m.constraints_new_event()}
            drawerContent={
              <Drawer
                title={m.constraints_new_event()}
                description={m.constraints_attention_hint()}
                customFooter
              >
                <ErrorSuspense>
                  <EventDetails
                    day={day}
                    timezone={timezone}
                  />
                </ErrorSuspense>
              </Drawer>
            }
          >
            <Plus />
            {m.constraints_event()}
          </DrawerButton>
          <DrawerButton
            variant="outline"
            aria-label={m.projects_new()}
            drawerContent={<ProjectCreateDrawer />}
          >
            <Plus />
            {m.projects_project()}
          </DrawerButton>
        </div>
      </header>
      {view === "projects" ? (
        <ProjectsView date={day} />
      ) : view === "day" ? (
        <div className="min-h-0 flex-1">
          <DayView selectedDay={day} />
        </div>
      ) : (
        <PlanOverview
          day={day}
          onDayChange={setDay}
          view={view}
          timezone={timezone}
          openDay={() => {
            void navigate({
              to: "/{-$locale}/dashboard/day",
              search: { date: day },
            });
          }}
        />
      )}
    </>
  );
}

function PlanOverview({
  day,
  onDayChange,
  view,
  timezone,
  openDay,
}: {
  day: string;
  onDayChange: (day: string) => void;
  view: "week" | "month";
  timezone: string;
  openDay: () => void;
}) {
  const { data: sessions } = useSuspenseQuery(
    convexQuery(api.sessions.listSessions, {})
  );
  const { data: events } = useSuspenseQuery(
    convexQuery(api.planning.listEvents, { timezone })
  );
  const { data: tasks } = useSuspenseQuery(
    convexQuery(api.planning.listWork, {})
  );
  const { data: settings } = useSuspenseQuery(
    convexQuery(api.planning.getSettings, {})
  );
  const { data: groups } = useSuspenseQuery(convexQuery(api.projects.list, {}));
  const { openDrawer } = useModal();
  const [project, setProject] = useState("all");
  const weekday = new Date(`${day}T12:00Z`).getUTCDay();
  const weekStart = shiftDate(
    day,
    -((weekday - (settings?.weekStartsOn ?? 1) + 7) % 7)
  );
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(weekStart, i));
  const clock = (at: number) =>
    new Intl.DateTimeFormat(getLocale(), {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(at);
  const dateLabel = (date: string) =>
    new Intl.DateTimeFormat(getLocale(), {
      timeZone: "UTC",
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(`${date}T12:00Z`));
  const itemsFor = (date: string) => {
    const bounds = dayBounds(date, timezone);
    return [
      ...sessions
        .filter((s) => s.startAt < bounds.endAt && s.endAt > bounds.startAt)
        .map((s) => ({
          id: s._id,
          title: s.taskTitle,
          session: s,
          eventDetails: undefined,
          startAt: s.startAt,
          endAt: s.endAt,
          event: false,
          allDay: false,
        })),
      ...events
        .filter((e) => e.startAt < bounds.endAt && e.endAt > bounds.startAt)
        .map((e) => ({
          id: e._id,
          title: e.sourceTitle ? `${e.title} · ${e.sourceTitle}` : e.title,
          session: undefined,
          eventDetails: e,
          startAt: e.startAt,
          endAt: e.endAt,
          event: true,
          allDay: !!e.allDayStart,
        })),
    ].sort((a, b) => a.startAt - b.startAt || a.endAt - b.endAt);
  };
  const openItem = (item: ReturnType<typeof itemsFor>[number]) => {
    openDrawer(
      <Drawer
        title={
          item.eventDetails
            ? m.constraints_event()
            : m.planning_session_details()
        }
        description={
          item.eventDetails
            ? m.constraints_attention_hint()
            : m.planning_session_description()
        }
        customFooter
      >
        <ErrorSuspense>
          {item.eventDetails ? (
            <EventDetails
              day={localDateTime(item.startAt, timezone).slice(0, 10)}
              timezone={timezone}
              event={item.eventDetails}
            />
          ) : (
            item.session && (
              <SessionDetails
                placement={{
                  taskId: item.session.taskId,
                  sessionId: item.session._id,
                  startAt: item.startAt,
                  endAt: item.endAt,
                }}
              />
            )
          )}
        </ErrorSuspense>
      </Drawer>
    );
  };
  const deadlinesFor = (date: string) =>
    tasks.filter(
      (t) =>
        t.dueAt !== undefined &&
        localDateTime(t.dueAt, timezone).slice(0, 10) === date
    );
  const workload = (date: string) => {
    const bounds = dayBounds(date, timezone);
    return Math.round(
      sessions
        .filter((s) => s.startAt < bounds.endAt && s.endAt > bounds.startAt)
        .reduce(
          (n, s) =>
            n +
            (Math.min(s.endAt, bounds.endAt) -
              Math.max(s.startAt, bounds.startAt)) /
              60000,
          0
        )
    );
  };
  const unscheduled = tasks.filter(
    (task) =>
      (project === "all" || task.projectId === project) &&
      (!sessions.some((s) => s.taskId === task._id && s.endAt > Date.now()) ||
        (task.effortMinutes !== undefined &&
          sessions
            .filter((s) => s.taskId === task._id)
            .reduce(
              (total, s) =>
                total +
                (s.checkIn
                  ? s.checkIn.timeMinutes
                  : (s.endAt - s.startAt) / 60000),
              0
            ) < task.effortMinutes))
  );
  const agenda = itemsFor(day);
  const deadlines = deadlinesFor(day);
  const selectedDate = new Date(`${day}T12:00:00`);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {view === "week" ? (
        <div className="overflow-x-auto border-y">
          <div className="grid min-w-[1050px] grid-cols-7">
            {days.map((date) => {
              const bounds = dayBounds(date, timezone);
              const minutes = (bounds.endAt - bounds.startAt) / 60000;
              const items = itemsFor(date);
              const positions = layoutSessions(
                items.map((item) => ({ ...item, _id: item.id }))
              );
              const protectedPeriods = settings
                ? availabilityOn(date, settings).protected
                : [];
              return (
                <section
                  key={date}
                  aria-label={dateLabel(date)}
                  className="min-w-0 border-r"
                >
                  <div className="h-28 overflow-y-auto">
                    <Button
                      variant={date === day ? "secondary" : "ghost"}
                      className="w-full"
                      onClick={() => onDayChange(date)}
                    >
                      {dateLabel(date)}
                    </Button>
                    <p className="px-2 text-xs">
                      {m.plan_workload({ minutes: workload(date) })}
                    </p>
                    {deadlinesFor(date).map((t) => (
                      <p
                        className="truncate px-2 text-xs"
                        key={t._id}
                      >
                        {t.finishKind === "preferred"
                          ? m.plan_preferred()
                          : m.plan_deadline()}
                        : {t.title}
                      </p>
                    ))}
                  </div>
                  <div
                    className="relative mt-2"
                    style={{ height: minutes }}
                  >
                    {Array.from({ length: Math.ceil(minutes / 60) }, (_, i) => (
                      <div
                        key={i}
                        className="text-muted-foreground absolute w-full border-t text-[10px]"
                        style={{ top: i * 60 }}
                      >
                        {clock(bounds.startAt + i * 3600000)}
                      </div>
                    ))}
                    {protectedPeriods.map((p, i) => (
                      <div
                        key={i}
                        className="bg-muted absolute inset-x-0 border-y border-dashed text-xs"
                        style={{
                          top: (p.startAt - bounds.startAt) / 60000,
                          height: (p.endAt - p.startAt) / 60000,
                        }}
                      >
                        {m.constraints_protected()}
                      </div>
                    ))}
                    {items.map((item, index) => {
                      const { lane, lanes } = positions.get(item.id)!;
                      return (
                        <button
                          type="button"
                          key={item.id}
                          className={`bg-background absolute overflow-hidden rounded border p-1 text-left text-xs focus:z-20 focus:ring-2 ${item.event ? "border-dashed" : "border-l-4 border-solid"}`}
                          style={{
                            top:
                              (Math.max(item.startAt, bounds.startAt) -
                                bounds.startAt) /
                              60000,
                            height: Math.max(
                              20,
                              (Math.min(item.endAt, bounds.endAt) -
                                Math.max(item.startAt, bounds.startAt)) /
                                60000
                            ),
                            width: `${100 / lanes}%`,
                            left: `${(lane * 100) / lanes}%`,
                            zIndex: index + 1,
                          }}
                          onClick={() => openItem(item)}
                        >
                          <strong>{item.title}</strong>
                          <span className="block">
                            {item.allDay
                              ? m.calendar_all_day()
                              : `${clock(item.startAt)}–${clock(item.endAt)}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto p-3">
          <Calendar
            hideNavigation
            mode="single"
            required
            selected={selectedDate}
            month={selectedDate}
            locale={getLocale() === "cs" ? cs : enUS}
            weekStartsOn={
              (settings?.weekStartsOn ?? 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6
            }
            onMonthChange={(date) => onDayChange(format(date, "yyyy-MM-dd"))}
            onSelect={(date) => date && onDayChange(format(date, "yyyy-MM-dd"))}
            className="w-full min-w-[700px] [--cell-size:7rem]"
            components={{
              DayButton: (props) => {
                const date = format(props.day.date, "yyyy-MM-dd");
                const items = itemsFor(date);
                const deadlines = deadlinesFor(date);
                return (
                  <div className="h-40 overflow-y-auto p-1">
                    <CalendarDayButton
                      {...props}
                      className="aspect-auto h-auto min-w-0 items-start justify-start p-1 text-left"
                    >
                      <strong>{props.day.date.getDate()}</strong>
                      <span>
                        {m.plan_workload({ minutes: workload(date) })}
                      </span>
                    </CalendarDayButton>
                    {items.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className="hover:bg-accent focus-visible:ring-ring block w-full truncate rounded px-1 py-0.5 text-left text-xs focus-visible:ring-2"
                        onClick={() => openItem(item)}
                      >
                        {item.title}
                      </button>
                    ))}
                    {deadlines.map((task) => (
                      <span
                        key={task._id}
                        className="block truncate px-1 text-xs"
                      >
                        {task.finishKind === "preferred"
                          ? m.plan_preferred()
                          : m.plan_deadline()}
                        : {task.title}
                      </span>
                    ))}
                  </div>
                );
              },
            }}
          />
        </div>
      )}
      <section
        className="space-y-3 border-t p-4"
        aria-label={m.plan_agenda()}
      >
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold">
            {m.plan_agenda()} · {dateLabel(day)}
          </h2>
          <Button onClick={openDay}>{m.plan_open_day()}</Button>
        </div>
        <p>{m.plan_workload({ minutes: workload(day) })}</p>
        <ul className="space-y-2">
          {agenda.map((item) => (
            <li
              key={item.id}
              className={`rounded border p-2 ${item.event ? "border-dashed" : "border-l-4"}`}
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => openItem(item)}
              >
                <strong>{item.title}</strong> ·{" "}
                {item.allDay
                  ? m.calendar_all_day()
                  : `${clock(item.startAt)}–${clock(item.endAt)}`}
              </button>
            </li>
          ))}
        </ul>
        {!agenda.length && <p>{m.plan_empty()}</p>}
        <ul>
          {deadlines.map((t) => (
            <li key={t._id}>
              {t.finishKind === "preferred"
                ? m.plan_preferred()
                : m.plan_deadline()}
              : {t.title} · {clock(t.dueAt!)}
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3 border-t p-4">
        <h2 className="font-semibold">{m.plan_unscheduled()}</h2>
        <label className="block max-w-64">
          {m.projects_project()}
          <Select
            value={project}
            onValueChange={setProject}
            options={[
              { value: "all", label: m.projects_all() },
              ...groups.projects.map((p) => ({ value: p._id, label: p.title })),
            ]}
          />
        </label>
        <ul>
          {unscheduled.map((task) => (
            <li
              key={task._id}
              className="flex items-center gap-3 py-1"
            >
              <span>
                {m.plan_unscheduled()}: {task.title}
                {task.effortMinutes !== undefined
                  ? ` · ${task.effortMinutes} min`
                  : ` · ${m.planning_estimate_needed()}`}
              </span>
              <Button
                variant="outline"
                onClick={openDay}
              >
                {m.plan_open_day()}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
