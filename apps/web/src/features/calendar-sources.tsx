import { useEffect, useRef, useState } from "react";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { useAction } from "@gc/convex";
import { api } from "@gc/convex/api";
import { Doc } from "@gc/convex/types";
import { m } from "@gc/i18n/messages";
import { getLocale } from "@gc/i18n/runtime";
import { Button, Checkbox, Select } from "@gc/ui";

export function CalendarAuthorization({
  state,
  code,
  onComplete,
}: {
  state?: string;
  code?: string;
  onComplete: () => void;
}) {
  const attempted = useRef<string | undefined>(undefined);
  const action = useAction(api.googleCalendar.completeAuthorization);
  const { mutate, isPending, isSuccess, isError } = useMutation({
    mutationFn: action,
    onSettled: onComplete,
  });
  useEffect(() => {
    if (!state || attempted.current === state) return;
    attempted.current = state;
    mutate({ state, code });
  }, [state, code, mutate]);
  if (isPending) return <p role="status">{m.calendar_authorizing()}</p>;
  if (isSuccess) return <p role="status">{m.calendar_connected()}</p>;
  if (isError) return <p role="alert">{m.calendar_connection_failed()}</p>;
  return null;
}

export function CalendarSources({ compact = false }: { compact?: boolean }) {
  const { data } = useSuspenseQuery(convexQuery(api.calendars.list, {}));
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const [access, setAccess] = useState<"busy" | "full">("busy");
  const connect = useAction(api.googleCalendar.connect);
  const authorization = useMutation({
    mutationFn: async () => {
      const popup = window.open("about:blank", "_blank");
      if (!popup) throw new Error(m.calendar_popup_blocked());
      popup.opener = null;
      try {
        popup.location.href = await connect({ access });
      } catch (error) {
        popup.close();
        throw error;
      }
    },
  });
  const refresh = useMutation({
    mutationFn: useConvexMutation(api.calendars.refresh),
  });
  const sources = data.sources.filter((s) => s.disconnectedAt === undefined);
  const stale = sources.filter(
    (s) => s.error || !s.lastSuccessAt || now - s.lastSuccessAt > 6 * 60_000
  );
  if (compact)
    return stale.length ? (
      <div
        role="status"
        className="border-b px-4 py-2 text-sm"
      >
        {m.calendar_stale()}: {stale.map((s) => s.title).join(", ")}.{" "}
        {m.calendar_previous_preserved()}
        <Link
          to="/{-$locale}/settings"
          className="ml-2 underline"
        >
          {m.calendar_manage()}
        </Link>
      </div>
    ) : null;
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {m.calendar_personal_hint()}
      </p>
      <label className="block space-y-1">
        {m.calendar_access()}
        <Select
          value={access}
          onValueChange={setAccess}
          options={[
            { value: "busy", label: m.calendar_busy_only() },
            { value: "full", label: m.calendar_full_events() },
          ]}
        />
      </label>
      <Button
        disabled={authorization.isPending}
        onClick={() => authorization.mutate()}
      >
        {m.calendar_connect()}
      </Button>
      {authorization.isError && (
        <p role="alert">{authorization.error.message}</p>
      )}
      {data.grants.map((grant) => (
        <CalendarGrant
          key={grant._id}
          grant={grant}
          sources={sources.filter((s) => s.grantId === grant._id)}
        />
      ))}
      {sources.map((source) => (
        <div
          key={source._id}
          className="space-y-1 rounded border p-3"
        >
          <p className="font-medium">
            {source.title} ·{" "}
            {source.access === "busy"
              ? m.calendar_busy_only()
              : m.calendar_full_events()}
          </p>
          <p className="text-sm">
            {m.calendar_last_success()}:{" "}
            {source.lastSuccessAt
              ? new Intl.DateTimeFormat(getLocale(), {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(source.lastSuccessAt)
              : m.calendar_never()}
          </p>
          <p className="text-muted-foreground text-xs">
            {m.calendar_scope_hint()}
          </p>
          {(source.refreshingUntil ?? 0) > now && (
            <p role="status">{m.calendar_refreshing()}</p>
          )}
          {source.error ? (
            <p role="alert">
              {m.calendar_refresh_failed()} {m.calendar_previous_preserved()}
            </p>
          ) : (
            (!source.lastSuccessAt ||
              now - source.lastSuccessAt > 6 * 60_000) && (
              <p role="status">{m.calendar_stale()}</p>
            )
          )}
          <Button
            variant="outline"
            disabled={refresh.isPending || (source.refreshingUntil ?? 0) > now}
            onClick={() => refresh.mutate({ sourceId: source._id })}
          >
            {m.calendar_refresh()}
          </Button>
          <CalendarSourceDisconnect source={source} />
        </div>
      ))}
      {refresh.isError && <p role="alert">{refresh.error.message}</p>}
    </div>
  );
}

function CalendarSourceDisconnect({
  source,
}: {
  source: Doc<"calendarSources">;
}) {
  const [confirming, setConfirming] = useState(false);
  const [removeRecords, setRemoveRecords] = useState(true);
  const disconnect = useMutation({
    mutationFn: useConvexMutation(api.calendars.disconnectSource),
  });
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        onClick={() => {
          setRemoveRecords(true);
          setConfirming(!confirming);
        }}
      >
        {m.calendar_disconnect_source()}
      </Button>
      {confirming && (
        <>
          <p className="text-sm">{m.calendar_disconnect_source_hint()}</p>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={removeRecords}
              onCheckedChange={(checked) => setRemoveRecords(checked === true)}
            />
            {m.calendar_remove_imported_events()}
          </label>
          <Button
            disabled={disconnect.isPending}
            onClick={() =>
              disconnect.mutate({ sourceId: source._id, removeRecords })
            }
          >
            {m.calendar_confirm_disconnect()}
          </Button>
        </>
      )}
      {disconnect.isError && <p role="alert">{disconnect.error.message}</p>}
    </div>
  );
}

function CalendarGrant({
  grant,
  sources,
}: {
  grant: Omit<Doc<"calendarGrants">, "credentials">;
  sources: Doc<"calendarSources">[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [disconnecting, setDisconnecting] = useState(false);
  const [removeRecords, setRemoveRecords] = useState(true);
  const select = useMutation({
    mutationFn: useConvexMutation(api.calendars.select),
    onSuccess: () => setSelected([]),
  });
  const disconnect = useMutation({
    mutationFn: useConvexMutation(api.calendars.disconnect),
  });
  return (
    <fieldset className="space-y-3 rounded border p-3">
      <legend className="px-1 font-medium">{grant.email}</legend>
      {grant.calendars
        .filter((c) => !sources.some((s) => s.calendarId === c.id))
        .map((calendar) => (
          <label
            key={calendar.id}
            className="flex items-center gap-2"
          >
            <Checkbox
              checked={selected.includes(calendar.id)}
              onCheckedChange={(checked) =>
                setSelected(
                  checked === true
                    ? [...selected, calendar.id]
                    : selected.filter((id) => id !== calendar.id)
                )
              }
            />
            {calendar.title}
          </label>
        ))}
      {!!selected.length && (
        <Button
          disabled={select.isPending}
          onClick={() =>
            select.mutate({ grantId: grant._id, calendarIds: selected })
          }
        >
          {m.calendar_import_selected()}
        </Button>
      )}
      <Button
        variant="outline"
        onClick={() => {
          setRemoveRecords(true);
          setDisconnecting(!disconnecting);
        }}
      >
        {m.calendar_disconnect()}
      </Button>
      {disconnecting && (
        <div className="space-y-2">
          <p className="text-sm">{m.calendar_disconnect_hint()}</p>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={removeRecords}
              onCheckedChange={(checked) => setRemoveRecords(checked === true)}
            />
            {m.calendar_remove_imported_events()}
          </label>
          <Button
            disabled={disconnect.isPending}
            onClick={() =>
              disconnect.mutate({ grantId: grant._id, removeRecords })
            }
          >
            {m.calendar_confirm_disconnect()}
          </Button>
        </div>
      )}
      {(select.isError || disconnect.isError) && (
        <p role="alert">{select.error?.message ?? disconnect.error?.message}</p>
      )}
    </fieldset>
  );
}
