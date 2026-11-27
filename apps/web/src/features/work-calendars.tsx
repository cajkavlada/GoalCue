import { useState } from "react";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { Id } from "@gc/convex/types";
import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Switch,
} from "@gc/ui";

import { PlanningDatePicker } from "./tasks/schedule-constraints";

export function WorkCalendars() {
  const { data: sources } = useSuspenseQuery(
    convexQuery(api.workCalendars.list, {})
  );
  const saveSource = useConvexMutation(api.workCalendars.saveSource);
  const preview = useConvexMutation(api.workCalendars.preview);
  const applyImport = useConvexMutation(api.workCalendars.applyImport);
  const [sourceId, setSourceId] = useState("new");
  const [text, setText] = useState("");
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [fullRefresh, setFullRefresh] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof preview>>>();
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useAppForm({
    defaultValues: { name: "" },
    onSubmit: async ({ value }) => {
      const id = await saveSource({ name: value.name, aiEnabled: false });
      setSourceId(id);
      form.reset();
    },
  });
  const args = { text, from, to, timezone };
  const source = sources.find((s) => s._id === sourceId);
  return (
    <Card className="w-full shrink-0">
      <CardHeader>
        <CardTitle>{m.work_calendar_title()}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <fieldset
          disabled={busy}
          className="space-y-4"
        >
          <p className="text-muted-foreground text-sm">
            {m.work_calendar_help()}
          </p>
          <label className="block space-y-1">
            <span>{m.work_calendar_source()}</span>
            <Select
              value={sourceId}
              onValueChange={(value) => {
                setSourceId(value);
                setResult(undefined);
                setSummary("");
              }}
              options={[
                { value: "new", label: m.work_calendar_new() },
                ...sources.map((s) => ({ value: s._id, label: s.name })),
              ]}
            />
          </label>
          {sourceId === "new" ? (
            <form.AppForm>
              <form.FormRoot>
                <form.AppField name="name">
                  {(field) => <field.Input label={m.work_calendar_source()} />}
                </form.AppField>
                <form.SubmitButton>
                  {m.work_calendar_create()}
                </form.SubmitButton>
              </form.FormRoot>
            </form.AppForm>
          ) : (
            source && (
              <>
                <label className="flex items-center gap-2">
                  <Switch
                    checked={source.aiEnabled}
                    onCheckedChange={async (aiEnabled) => {
                      try {
                        await saveSource({
                          sourceId: source._id,
                          name: source.name,
                          aiEnabled,
                        });
                      } catch (e) {
                        setError(String(e));
                      }
                    }}
                  />
                  {m.work_calendar_ai()}
                </label>
                {source.lastSuccessAt && (
                  <p className="text-sm">
                    {m.work_calendar_last()}{" "}
                    {new Date(source.lastSuccessAt).toLocaleString()}
                  </p>
                )}
                <label className="block space-y-1">
                  <span>{m.work_calendar_file()}</span>
                  <Input
                    type="file"
                    accept=".ics,text/calendar"
                    disabled={busy}
                    onChange={async (e) => {
                      setResult(undefined);
                      setSummary("");
                      setText("");
                      setError("");
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 500000) {
                        setError(m.work_calendar_size());
                        return;
                      }
                      setBusy(true);
                      try {
                        setText(await file.text());
                      } catch (e) {
                        setError(String(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                </label>
                <PlanningDatePicker
                  label={m.work_calendar_from()}
                  value={from}
                  onChange={(value) => {
                    setFrom(value);
                    setResult(undefined);
                  }}
                />
                <PlanningDatePicker
                  label={m.work_calendar_to()}
                  value={to}
                  onChange={(value) => {
                    setTo(value);
                    setResult(undefined);
                  }}
                />
                <label className="block space-y-1">
                  <span>{m.constraints_timezone()}</span>
                  <Input
                    value={timezone}
                    onChange={(e) => {
                      setTimezone(e.target.value);
                      setResult(undefined);
                    }}
                  />
                </label>
                <label className="flex items-center gap-2">
                  <Switch
                    checked={fullRefresh}
                    onCheckedChange={setFullRefresh}
                  />
                  {m.work_calendar_full()}
                </label>
                <p className="text-muted-foreground text-sm">
                  {m.work_calendar_scope()}
                </p>
                <div className="flex gap-2">
                  <Button
                    disabled={busy || !text}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      setSummary("");
                      try {
                        setResult(await preview(args));
                      } catch (e) {
                        setError(String(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {m.work_calendar_preview()}
                  </Button>
                  <Button
                    disabled={
                      busy || !text || !result || result.errors.length > 0
                    }
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        const imported = await applyImport({
                          ...args,
                          sourceId: sourceId as Id<"workCalendarSources">,
                          fullRefresh,
                        });
                        setResult(imported);
                        setSummary(
                          m.work_calendar_result({
                            imported: imported.imported,
                            changed: imported.changed,
                            removed: imported.removed,
                            rejected: imported.errors.length,
                          })
                        );
                        setText("");
                      } catch (e) {
                        setError(String(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {m.work_calendar_apply()}
                  </Button>
                </div>
              </>
            )
          )}
          {error && (
            <p
              role="alert"
              className="text-destructive"
            >
              {error}
            </p>
          )}
          {summary && <p role="status">{summary}</p>}
          {result && (
            <div
              className="max-h-80 space-y-2 overflow-auto"
              aria-live="polite"
            >
              {result.errors.length > 0 && (
                <p role="alert">
                  {m.work_calendar_rejected({ count: result.errors.length })}
                </p>
              )}
              {result.errors.map((message, index) => (
                <p
                  key={index}
                  className="text-destructive text-sm"
                >
                  {message}
                </p>
              ))}
              {result.cancellations.map((item, index) => (
                <p key={index}>
                  {m.work_calendar_cancelled()}: {item.uid} {item.recurrenceId}
                </p>
              ))}
              <p>{m.work_calendar_parsed({ count: result.events.length })}</p>
              {result.events.map((event) => (
                <div
                  key={event.key}
                  className="rounded border p-2 text-sm"
                >
                  <p className="font-medium">
                    {event.title}
                    {event.cancelled ? ` (${m.work_calendar_cancelled()})` : ""}
                  </p>
                  <p>
                    {event.allDayStart
                      ? `${event.allDayStart} – ${event.allDayEnd} (${m.work_calendar_all_day()})`
                      : `${new Date(event.startAt).toLocaleString(undefined, { timeZone: timezone })} – ${new Date(event.endAt).toLocaleString(undefined, { timeZone: timezone })}`}
                  </p>
                  {event.location && <p>{event.location}</p>}
                  {event.meetingLink && (
                    <p className="break-all">{event.meetingLink}</p>
                  )}
                  {event.recurrence && <p>{event.recurrence.join("; ")}</p>}
                </div>
              ))}
            </div>
          )}
        </fieldset>
      </CardContent>
    </Card>
  );
}
