import { useEffect, useRef, useState } from "react";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  Check,
  CircleSlash,
  Clock3,
  History,
  TimerReset,
  X,
} from "lucide-react";

import { api } from "@gc/convex/api";
import { Doc, Id } from "@gc/convex/types";
import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { Button, Checkbox, Drawer, Input, useModal } from "@gc/ui";
import { localDateTime, shiftDate, supportsBatchCheckIn } from "@gc/validators";

import { selectSessionRows } from "./day-calendar-layout";

export type CalendarSession = Doc<"sessions"> & {
  taskTitle: string;
  taskCompletedAt?: number;
  progressMeasure?: "done" | "time" | "percentage" | "quantity";
  progressUnit?: string;
};

export function SessionCheckInTray({
  sessions,
  timezone,
  onReview,
  reviewOpen,
}: {
  sessions: CalendarSession[];
  timezone: string;
  onReview: () => void;
  reviewOpen: boolean;
}) {
  const row = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry!.contentRect.width)
    );
    observer.observe(row.current!);
    return () => observer.disconnect();
  }, []);
  const allFit = sessions.length <= Math.floor((width + 8) / 240);
  const visibleCount = Math.max(
    1,
    Math.floor((width - (allFit ? 0 : 88) + 8) / 240)
  );
  const queued = Math.max(0, sessions.length - visibleCount);
  return (
    <section
      aria-label={m.check_in_title()}
      className="bg-muted/20 shrink-0 overflow-hidden border-t p-3"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          {m.check_in_pending_count({ count: sessions.length })}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onReview}
          aria-expanded={reviewOpen}
          aria-controls="session-review-panel"
        >
          <History className="size-3.5" />
          {m.check_in_review_sessions()}
        </Button>
      </div>
      <div
        ref={row}
        className={`flex min-w-0 items-center gap-2 ${expanded ? "overflow-x-auto overscroll-x-contain pb-2" : "justify-end"}`}
        tabIndex={expanded ? 0 : undefined}
        role={expanded ? "region" : undefined}
        aria-label={expanded ? m.check_in_title() : undefined}
      >
        {sessions
          .slice(0, expanded ? sessions.length : visibleCount)
          .map((session) => (
            <CheckInCard
              key={session._id}
              session={session}
              timezone={timezone}
              width={
                expanded
                  ? 232
                  : Math.max(0, Math.min(232, width - (queued ? 88 : 0)))
              }
            />
          ))}
        {queued > 0 && !expanded && (
          <Button
            type="button"
            variant="ghost"
            className="h-auto w-20 shrink-0 flex-col gap-0.5 px-1 py-2"
            aria-label={m.check_in_queue({ count: queued })}
            aria-expanded={expanded}
            onClick={() => setExpanded(true)}
          >
            <span className="text-base font-semibold tabular-nums">
              +{queued}
            </span>
            <span className="text-muted-foreground text-xs">
              {m.check_in_queued()}
            </span>
          </Button>
        )}
      </div>
    </section>
  );
}

function CheckInCard({
  session,
  timezone,
  width,
}: {
  session: CalendarSession;
  timezone: string;
  width: number;
}) {
  const { openDrawer } = useModal();
  const report = useMutation({
    mutationFn: useConvexMutation(api.sessions.reportCheckIn),
  });
  const open = () => openDrawer(<CheckInDrawer sessionId={session._id} />);
  const date = new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(session.startAt);
  const end = new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(session.endAt);
  return (
    <article
      style={{ width }}
      tabIndex={0}
      role="group"
      aria-label={`${m.check_in_title()}: ${session.taskTitle}`}
      onClick={(e) => {
        if (!(e.target as Element).closest("button")) open();
      }}
      onKeyDown={(e) => {
        if (
          e.target === e.currentTarget &&
          (e.key === "Enter" || e.key === " ")
        ) {
          e.preventDefault();
          open();
        }
      }}
      className="bg-background animate-in fade-in slide-in-from-right-4 focus-visible:ring-primary min-w-0 shrink-0 cursor-pointer rounded-xl border p-3 shadow-sm outline-none duration-300 first:ml-auto focus-visible:ring-2 motion-reduce:animate-none"
    >
      <p
        className="truncate text-sm font-medium"
        title={session.taskTitle}
      >
        {session.taskTitle}
      </p>
      <p className="text-muted-foreground mt-0.5 truncate text-xs">
        {date}–{end}
      </p>
      <div className="mt-2.5 flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          className="mr-auto h-7 gap-1 px-2 text-xs"
          disabled={report.isPending}
          onClick={() =>
            report.mutate({ sessionId: session._id, outcome: "finished" })
          }
        >
          <Check className="size-3.5" />
          {m.check_in_finished()}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 shrink-0"
          tooltip={m.check_in_missed()}
          aria-label={m.check_in_missed()}
          disabled={report.isPending}
          onClick={() =>
            report.mutate({ sessionId: session._id, outcome: "missed" })
          }
        >
          <CircleSlash className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 shrink-0"
          tooltip={m.check_in_later_tooltip()}
          aria-label={m.check_in_later_tooltip()}
          disabled={report.isPending}
          onClick={() =>
            report.mutate({ sessionId: session._id, outcome: "later" })
          }
        >
          <Clock3 className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 shrink-0"
          tooltip={m.check_in_working_tooltip()}
          aria-label={m.check_in_working_tooltip()}
          disabled={report.isPending}
          onClick={() =>
            report.mutate({
              sessionId: session._id,
              outcome: "working",
              extensionMinutes: 15,
            })
          }
        >
          <TimerReset className="size-3.5" />
        </Button>
      </div>
      {report.error && (
        <p
          role="alert"
          className="mt-2 text-xs"
        >
          {report.error.message}
        </p>
      )}
    </article>
  );
}

export function CheckInDrawer({ sessionId }: { sessionId: Id<"sessions"> }) {
  return (
    <Drawer
      title={m.check_in_title()}
      description={m.check_in_review()}
    >
      <ErrorSuspense>
        <CheckInDetails sessionId={sessionId} />
      </ErrorSuspense>
    </Drawer>
  );
}

function CheckInDetails({ sessionId }: { sessionId: Id<"sessions"> }) {
  const { data: sessions } = useSuspenseQuery(
    convexQuery(api.sessions.listSessions, {})
  );
  const session = sessions.find((s) => s._id === sessionId);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {session ? (
        <SessionCheckIn
          key={session._id}
          session={session}
        />
      ) : (
        <p className="text-muted-foreground text-sm">{m.check_in_clear()}</p>
      )}
    </div>
  );
}

export function SessionCheckIn({ session }: { session: CalendarSession }) {
  const [value, setValue] = useState(session.checkIn?.value?.toString() ?? "");
  const [minutes, setMinutes] = useState(
    session.checkIn?.timeMinutes.toString() ?? ""
  );
  const [remaining, setRemaining] = useState(
    session.checkIn?.remainingMinutes?.toString() ?? ""
  );
  const [extension, setExtension] = useState("15");
  const report = useMutation({
    mutationFn: useConvexMutation(api.sessions.reportCheckIn),
  });
  const numericMeasure =
    session.progressMeasure && session.progressMeasure !== "done";
  const invalid =
    [value, minutes, remaining].some(
      (v) => v !== "" && (!Number.isFinite(Number(v)) || Number(v) < 0)
    ) ||
    (session.progressMeasure === "percentage" && Number(value) > 100);
  return (
    <div className="space-y-5 py-2">
      <div>
        <h3 className="font-medium">{session.taskTitle}</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          {new Date(session.startAt).toLocaleString()}–
          {new Date(session.endAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
      <div className="flex items-end gap-2">
        {numericMeasure ? (
          <label className="min-w-0 flex-1 text-sm">
            {session.progressMeasure === "percentage"
              ? m.check_in_percentage()
              : m.check_in_amount()}
            {session.progressMeasure !== "percentage" &&
              (session.progressUnit || session.progressMeasure === "time") &&
              ` (${session.progressMeasure === "time" ? m.planning_minutes() : session.progressUnit})`}
            <Input
              className="mt-1"
              type="number"
              min={0}
              max={session.progressMeasure === "percentage" ? 100 : undefined}
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
        ) : (
          <p className="text-muted-foreground flex-1 text-sm">
            {m.check_in_worked_hint()}
          </p>
        )}
        <Button
          type="button"
          disabled={
            report.isPending || invalid || (!!numericMeasure && value === "")
          }
          onClick={() =>
            report.mutate({
              sessionId: session._id,
              outcome: "progress",
              value: value === "" ? undefined : Number(value),
              timeMinutes: minutes === "" ? undefined : Number(minutes),
              remainingMinutes:
                remaining === "" ? undefined : Number(remaining),
            })
          }
        >
          {numericMeasure ? m.check_in_progress() : m.check_in_worked()}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={report.isPending || invalid}
          onClick={() =>
            report.mutate({
              sessionId: session._id,
              outcome: "finished",
              timeMinutes: minutes === "" ? undefined : Number(minutes),
            })
          }
        >
          {m.check_in_finished()}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={report.isPending}
          onClick={() =>
            report.mutate({ sessionId: session._id, outcome: "missed" })
          }
        >
          {m.check_in_missed()}
        </Button>
      </div>
      {!session.checkIn && (
        <div className="flex items-end gap-2 border-t pt-4">
          <label className="min-w-0 flex-1 text-sm">
            {m.check_in_extension()}
            <Input
              className="mt-1"
              type="number"
              min={1}
              max={1440}
              value={extension}
              onChange={(e) => setExtension(e.target.value)}
              list={`extensions-${session._id}`}
            />
            <datalist id={`extensions-${session._id}`}>
              <option value="15" />
              <option value="30" />
            </datalist>
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={
              report.isPending ||
              !Number.isFinite(Number(extension)) ||
              Number(extension) <= 0 ||
              Number(extension) > 1440
            }
            onClick={() =>
              report.mutate({
                sessionId: session._id,
                outcome: "working",
                extensionMinutes: Number(extension),
              })
            }
          >
            {m.check_in_working()}
          </Button>
        </div>
      )}
      <details className="border-t pt-3">
        <summary className="text-muted-foreground cursor-pointer text-sm">
          {m.check_in_optional()}
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-sm">
            {m.check_in_time()}
            <Input
              className="mt-1"
              type="number"
              min={0}
              step="any"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </label>
          <label className="text-sm">
            {m.check_in_remaining()}
            <Input
              className="mt-1"
              type="number"
              min={0}
              step="any"
              value={remaining}
              onChange={(e) => setRemaining(e.target.value)}
            />
          </label>
        </div>
      </details>
      <div className="flex justify-end border-t pt-2">
        {session.checkIn ? (
          <Button
            type="button"
            variant="ghost"
            disabled={report.isPending}
            onClick={() =>
              report.mutate({ sessionId: session._id, outcome: "undo" })
            }
          >
            {m.check_in_undo()}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            disabled={report.isPending}
            onClick={() =>
              report.mutate({ sessionId: session._id, outcome: "later" })
            }
          >
            {m.check_in_later()}
          </Button>
        )}
      </div>
      {report.isSuccess && (
        <p
          role="status"
          className="text-sm"
        >
          {m.check_in_saved()}
        </p>
      )}
      {report.error && (
        <p
          role="alert"
          className="text-sm"
        >
          {report.error.message}
        </p>
      )}
    </div>
  );
}

export function SessionReviewPanel({
  sessions,
  timezone,
  now,
  onClose,
}: {
  sessions: CalendarSession[];
  timezone: string;
  now: number;
  onClose: () => void;
}) {
  const [status, setStatus] = useState("pending");
  const [period, setPeriod] = useState("all");
  const [search, setSearch] = useState("");
  const today = localDateTime(now, timezone).slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [selected, setSelected] = useState(new Set<string>());
  const [selectionMode, setSelectionMode] = useState(false);
  const anchor = useRef<string | null>(null);
  const { data: lastBatch } = useQuery(
    convexQuery(api.sessions.getLastCheckInBatch, {})
  );
  const batchId =
    lastBatch?.undoneAt === undefined ? lastBatch?.batchId : undefined;
  const { openDrawer } = useModal();
  const batch = useMutation({
    mutationFn: useConvexMutation(api.sessions.batchCheckIn),
    onSuccess: () => {
      setSelected(new Set());
      anchor.current = null;
    },
  });
  const undo = useMutation({
    mutationFn: useConvexMutation(api.sessions.undoBatchCheckIn),
  });
  const rows = sessions
    .filter((session) => {
      const date = localDateTime(session.startAt, timezone).slice(0, 10);
      const due =
        session.endAt <= now || session.checkInRequestedAt !== undefined;
      return (
        session.taskTitle
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase()) &&
        (status === "all" ||
          (status === "answered"
            ? !!session.checkIn
            : due &&
              !session.checkIn &&
              session.taskCompletedAt === undefined)) &&
        (period === "all" ||
          (period === "today"
            ? date === today
            : period === "yesterday"
              ? date === shiftDate(today, -1)
              : date >= from && date <= to))
      );
    })
    .sort((a, b) => b.endAt - a.endAt || b.startAt - a.startAt);
  const visibleIds = rows.map((row) => row._id);
  const chosen = rows.filter((row) => selected.has(row._id));
  const supported =
    chosen.length > 0 &&
    chosen.every((session) => supportsBatchCheckIn(session, now));
  const taskCount = new Set(chosen.map((session) => session.taskId)).size;
  const busy = batch.isPending || undo.isPending;
  const clearSelection = () => {
    setSelected(new Set());
    anchor.current = null;
  };
  const select = (id: string, shift: boolean, toggle: boolean) => {
    const next = selectSessionRows(
      visibleIds,
      selected,
      anchor.current,
      id,
      shift,
      toggle || selectionMode
    );
    setSelected(next.selected);
    anchor.current = next.anchor;
  };
  const apply = (outcome: "finished" | "missed" | "later") =>
    batch.mutate({ sessionIds: chosen.map((session) => session._id), outcome });
  return (
    <section
      id="session-review-panel"
      aria-label={m.check_in_review_sessions()}
      className="bg-background flex h-full min-h-0 flex-1 flex-col"
    >
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <h2 className="mr-auto text-sm font-semibold">
          {m.check_in_review_sessions()}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => setSelectionMode((value) => !value)}
          aria-pressed={selectionMode}
        >
          {m.check_in_select_mode()}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={m.check_in_close_review()}
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2 border-b px-3 py-2">
        <label className="text-xs">
          {m.check_in_filter_status()}
          <select
            className="bg-background mt-1 block rounded border px-2 py-1.5"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              clearSelection();
            }}
          >
            <option value="pending">{m.check_in_pending()}</option>
            <option value="answered">{m.check_in_answered()}</option>
            <option value="all">{m.check_in_all_sessions()}</option>
          </select>
        </label>
        <label className="text-xs">
          {m.planning_date()}
          <select
            className="bg-background mt-1 block rounded border px-2 py-1.5"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              clearSelection();
            }}
          >
            <option value="all">{m.check_in_all_dates()}</option>
            <option value="today">{m.check_in_today()}</option>
            <option value="yesterday">{m.check_in_yesterday()}</option>
            <option value="range">{m.check_in_date_range()}</option>
          </select>
        </label>
        {period === "range" && (
          <>
            <label className="text-xs">
              {m.check_in_from()}
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  clearSelection();
                }}
              />
            </label>
            <label className="text-xs">
              {m.check_in_to()}
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  clearSelection();
                }}
              />
            </label>
          </>
        )}
        <label className="min-w-32 flex-1 text-xs">
          {m.check_in_search()}
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              clearSelection();
            }}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-xs">
        <span aria-live="polite">
          {m.check_in_selected({ count: chosen.length })}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy || !rows.length}
          onClick={() => setSelected(new Set(visibleIds))}
        >
          {m.check_in_select_matching()}
        </Button>
        {chosen.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={clearSelection}
          >
            {m.check_in_clear_selection()}
          </Button>
        )}
        {supported && (
          <>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => apply("finished")}
            >
              {m.check_in_complete_tasks({ count: taskCount })}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => apply("missed")}
            >
              {m.check_in_missed()}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => apply("later")}
            >
              {m.check_in_later()}
            </Button>
          </>
        )}
        {batchId && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => undo.mutate({ batchId })}
          >
            {m.check_in_undo_batch()}
          </Button>
        )}
        {chosen.length > 0 && !supported && (
          <span>{m.check_in_no_common_actions()}</span>
        )}
        {(batch.error || undo.error) && (
          <p
            role="alert"
            className="basis-full"
          >
            {batch.error?.message ?? undo.error?.message}
          </p>
        )}
        {batch.isSuccess && <span role="status">{m.check_in_saved()}</span>}
      </div>
      <p className="text-muted-foreground px-3 py-1 text-xs">
        {m.check_in_selection_hint()}
      </p>
      <div className="min-h-0 flex-1 overflow-auto">
        <table
          role="grid"
          aria-multiselectable="true"
          className="w-full text-left text-sm"
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
              e.preventDefault();
              setSelected(new Set(visibleIds));
            }
          }}
        >
          <thead className="bg-muted [&_th]:bg-muted sticky top-0 z-10 text-xs">
            <tr>
              {selectionMode && (
                <th className="w-10 p-2">
                  <span className="sr-only">{m.check_in_select_mode()}</span>
                </th>
              )}
              <th className="p-2">{m.check_in_task()}</th>
              <th className="p-2">{m.check_in_session_time()}</th>
              <th className="p-2">{m.check_in_outcome()}</th>
              <th className="p-2">
                <span className="sr-only">{m.check_in_review()}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((session) => (
              <tr
                key={session._id}
                tabIndex={0}
                aria-selected={selected.has(session._id)}
                className={`cursor-pointer select-none border-t outline-none focus-visible:ring-2 focus-visible:ring-inset ${selected.has(session._id) ? "bg-primary/10" : "hover:bg-muted/40"}`}
                onClick={(e) => {
                  if (!(e.target as Element).closest("button"))
                    select(session._id, e.shiftKey, e.ctrlKey || e.metaKey);
                }}
                onDoubleClick={(e) => {
                  if (!(e.target as Element).closest("button"))
                    openDrawer(<CheckInDrawer sessionId={session._id} />);
                }}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === " ") {
                    e.preventDefault();
                    select(session._id, e.shiftKey, e.ctrlKey || e.metaKey);
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    openDrawer(<CheckInDrawer sessionId={session._id} />);
                  }
                }}
              >
                {selectionMode && (
                  <td className="p-2">
                    <Checkbox
                      aria-label={`${m.check_in_select_mode()}: ${session.taskTitle}`}
                      checked={selected.has(session._id)}
                      onCheckedChange={() => select(session._id, false, true)}
                    />
                  </td>
                )}
                <td
                  className="max-w-60 truncate p-2"
                  title={session.taskTitle}
                >
                  {session.taskTitle}
                </td>
                <td className="whitespace-nowrap p-2 text-xs">
                  {new Intl.DateTimeFormat(undefined, {
                    timeZone: timezone,
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(session.startAt)}
                </td>
                <td className="p-2 text-xs">
                  {session.checkIn
                    ? session.checkIn.outcome === "finished"
                      ? m.check_in_finished()
                      : session.checkIn.outcome === "progress"
                        ? m.check_in_progress()
                        : m.check_in_missed()
                    : (session.askAfter ?? 0) > now
                      ? m.check_in_later()
                      : session.endAt <= now ||
                          session.checkInRequestedAt !== undefined
                        ? m.check_in_pending()
                        : m.check_in_scheduled()}
                </td>
                <td className="p-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      openDrawer(<CheckInDrawer sessionId={session._id} />)
                    }
                  >
                    {m.check_in_review()}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-muted-foreground p-4 text-sm">
            {m.check_in_no_sessions()}
          </p>
        )}
      </div>
    </section>
  );
}
