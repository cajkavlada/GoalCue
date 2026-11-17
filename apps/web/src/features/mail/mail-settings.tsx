import { useEffect, useRef, useState } from "react";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { Doc, Id } from "@gc/convex/types";
import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { getLocale } from "@gc/i18n/runtime";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  Switch,
} from "@gc/ui";

import { env } from "@/env";
import { priorityClassApi } from "../priority-classes/priority-class.api";
import { taskTypeApi } from "../task-types/task-type.api";
import {
  connectMail,
  listMessages,
  loadGoogleIdentity,
  MailSession,
  Message,
  readMessage,
} from "./gmail";

export function MailSettings() {
  const { data } = useSuspenseQuery(convexQuery(api.mail.list, {}));
  const [session, setSession] = useState<MailSession>();
  const [sourceId, setSourceId] = useState<Id<"mailSources">>();
  const [messages, setMessages] = useState<{ id: string; threadId: string }[]>(
    []
  );
  const [message, setMessage] = useState<
    Message & { permissionVersion: string }
  >();
  const [batchTask, setBatchTask] = useState<Id<"tasks">>();
  const [ready, setReady] = useState(false);
  const [personal, setPersonal] = useState(false);
  const [disconnectMode, setDisconnectMode] = useState<"manual" | "stop">(
    "manual"
  );
  const source = data.sources.find((s) => s._id === sourceId);
  const disconnect = useConvexMutation(api.mail.disconnect);
  const startBatch = useConvexMutation(api.mail.startBatch);
  const reviewMessage = useConvexMutation(api.mail.reviewMessage);
  const completeReview = useConvexMutation(api.taskActions.add);
  const refreshed = useConvexMutation(api.mail.refreshed);
  const queryClient = useQueryClient();
  const operation = useMutation({
    mutationFn: async (run: () => Promise<void>) => run(),
  });
  useEffect(() => {
    if (env.VITE_GOOGLE_CLIENT_ID)
      void loadGoogleIdentity()
        .then(() => setReady(true))
        .catch(() => setReady(false));
  }, []);
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(
      () => {
        setSession(undefined);
        setMessages([]);
        setMessage(undefined);
      },
      Math.max(0, session.expiresAt - Date.now())
    );
    return () => clearTimeout(timer);
  }, [session]);
  const sourceVersion = JSON.stringify(source);
  const reads = useRef(new AbortController());
  useEffect(() => {
    reads.current.abort();
    reads.current = new AbortController();
    return () => reads.current.abort();
  }, [sourceVersion, session]);
  useEffect(() => {
    setMessage(undefined);
  }, [sourceVersion]);

  return (
    <Card className="mx-auto w-full max-w-xl shrink-0">
      <CardHeader>
        <CardTitle>{m.mail_title()}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">{m.mail_read_only()}</p>
        <label className="flex items-center gap-2">
          <Switch
            checked={personal}
            onCheckedChange={setPersonal}
          />
          {m.mail_personal_only()}
        </label>
        <Button
          disabled={!ready || !personal || operation.isPending}
          onClick={() =>
            operation.mutate(async () => {
              const next = await connectMail();
              setSession(next);
              setMessage(undefined);
              setMessages([]);
            })
          }
        >
          {m.mail_connect()}
        </Button>
        {!env.VITE_GOOGLE_CLIENT_ID && <p>{m.mail_not_configured()}</p>}
        {session && (
          <SourceForm
            key={session.account}
            session={session}
            onSave={setSourceId}
          />
        )}
        <Select
          aria-label={m.mail_source()}
          value={sourceId ?? ""}
          onValueChange={(value) => {
            setSourceId(value as Id<"mailSources">);
            setMessages([]);
            setBatchTask(undefined);
          }}
          options={data.sources.map((s) => ({
            value: s._id,
            label: `${s.account} · ${s.labelName}${!s.connected || s.excluded ? ` · ${m.mail_unavailable()}` : ""}`,
          }))}
        />
        {source && (
          <>
            <p className="text-muted-foreground text-sm">
              {source.lastSuccessAt
                ? m.mail_last_refresh({
                    time: new Date(source.lastSuccessAt).toLocaleString(
                      getLocale()
                    ),
                  })
                : m.mail_no_refresh()}
            </p>
            {(!session ||
              session.account !== source.account ||
              !source.connected ||
              source.excluded) && <p role="status">{m.mail_unavailable()}</p>}
            <SourcePermissions
              key={sourceVersion}
              source={source}
            />
            <Select
              aria-label={m.mail_disconnect_choice()}
              value={disconnectMode}
              onValueChange={setDisconnectMode}
              options={[
                { value: "manual", label: m.mail_keep_manual() },
                { value: "stop", label: m.mail_stop_routines() },
              ]}
            />
            <Button
              variant="outline"
              disabled={!source.connected || operation.isPending}
              onClick={() =>
                operation.mutate(async () => {
                  await disconnect({
                    sourceId: source._id,
                    routines: disconnectMode,
                  });
                  if (session)
                    window.google?.accounts.oauth2.revoke(
                      session.token,
                      () => {}
                    );
                  setSession(undefined);
                  setMessage(undefined);
                  setMessages([]);
                })
              }
            >
              {m.mail_disconnect()}
            </Button>
            <Button
              disabled={
                !session ||
                !source.connected ||
                source.excluded ||
                operation.isPending
              }
              onClick={() =>
                operation.mutate(async () => {
                  setMessage(undefined);
                  setBatchTask(undefined);
                  setMessages(
                    await listMessages(
                      { ...session!, signal: reads.current.signal },
                      source
                    )
                  );
                  await refreshed({ sourceId: source._id });
                })
              }
            >
              {m.mail_refresh()}
            </Button>
          </>
        )}
        <RoutineForm sourceId={source?._id} />
        <p className="text-muted-foreground text-sm">{m.mail_routine_help()}</p>
        {data.routines.map((task) => (
          <div
            key={task._id}
            className="space-y-2 rounded border p-2"
          >
            <span>{task.title}</span>
            {task.occurrenceStartAt !== undefined && (
              <p className="text-muted-foreground text-sm">
                {new Intl.DateTimeFormat(getLocale(), {
                  dateStyle: "medium",
                  timeZone: task.occurrenceTimezone,
                }).format(task.occurrenceStartAt)}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={
                  operation.isPending ||
                  !session ||
                  !data.sources.find((s) => s._id === task.mailSourceId)
                    ?.connected
                }
                onClick={() =>
                  operation.mutate(async () => {
                    const selected = data.sources.find(
                      (s) => s._id === task.mailSourceId
                    )!;
                    let batch = await queryClient.fetchQuery({
                      ...convexQuery(api.mail.batch, { taskId: task._id }),
                      staleTime: 0,
                    });
                    if (!batch) {
                      const ids = await listMessages(
                        { ...session!, signal: reads.current.signal },
                        selected,
                        task.mailBatchSize ?? 25
                      );
                      await startBatch({
                        taskId: task._id,
                        messageIds: ids.map((i) => i.id),
                        manual: false,
                      });
                      batch = await queryClient.fetchQuery({
                        ...convexQuery(api.mail.batch, { taskId: task._id }),
                        staleTime: 0,
                      });
                    }
                    setSourceId(selected._id);
                    setBatchTask(task._id);
                    setMessage(undefined);
                    setMessages(
                      batch!.messageIds.map((id) => ({ id, threadId: "" }))
                    );
                  })
                }
              >
                {m.mail_start_batch()}
              </Button>
              <Button
                variant="outline"
                disabled={operation.isPending}
                onClick={() =>
                  operation.mutate(async () => {
                    await startBatch({
                      taskId: task._id,
                      messageIds: [],
                      manual: true,
                    });
                    setBatchTask(task._id);
                    setMessage(undefined);
                    setMessages([]);
                  })
                }
              >
                {m.mail_review_manually()}
              </Button>
            </div>
            <BatchProgress taskId={task._id} />
            <Button
              variant="outline"
              disabled={operation.isPending}
              onClick={() =>
                operation.mutate(async () => {
                  await completeReview({ taskId: task._id, boolValue: true });
                })
              }
            >
              {m.mail_complete_review()}
            </Button>
          </div>
        ))}
        {messages.length > 0 && (
          <p>{m.mail_batch_messages({ count: messages.length })}</p>
        )}
        {messages.map((item, index) => (
          <Button
            key={item.id}
            variant="outline"
            className="mr-2"
            disabled={operation.isPending || !session || !source}
            onClick={() =>
              operation.mutate(async () => {
                setMessage({
                  ...(await readMessage(
                    { ...session!, signal: reads.current.signal },
                    source!,
                    item.id
                  )),
                  permissionVersion: sourceVersion,
                });
              })
            }
          >
            {m.mail_message_index({ index: index + 1 })}
          </Button>
        ))}
        {message &&
          source &&
          session &&
          message.permissionVersion === sourceVersion && (
            <div className="space-y-3 rounded border p-3">
              <a
                href={`https://mail.google.com/mail/u/${encodeURIComponent(source.account)}/#all/${message.id}`}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {message.subject || m.mail_open_message()}
              </a>
              <p>{message.from}</p>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-sm">
                {message.text}
              </pre>
              {message.attachments.map((text, i) => (
                <pre
                  key={i}
                  className="max-h-48 overflow-auto whitespace-pre-wrap text-sm"
                >
                  {text}
                </pre>
              ))}
              <ActionForm
                key={`${source._id}:${message.id}`}
                source={source}
                message={message}
              />
              {batchTask && (
                <Button
                  onClick={() =>
                    operation.mutate(async () => {
                      await reviewMessage({
                        taskId: batchTask,
                        messageId: message.id,
                      });
                    })
                  }
                >
                  {m.mail_mark_reviewed()}
                </Button>
              )}
            </div>
          )}
        {operation.isError && <p role="alert">{operation.error.message}</p>}
      </CardContent>
    </Card>
  );
}

function SourceForm({
  session,
  onSave,
}: {
  session: MailSession;
  onSave: (id: Id<"mailSources">) => void;
}) {
  const save = useConvexMutation(api.mail.saveSource);
  const form = useAppForm({
    defaultValues: {
      labelId:
        session.labels.find((l) => l.id === "INBOX")?.id ??
        session.labels[0]?.id ??
        "",
      bodies: false,
      threadContext: false,
      attachments: false,
      aiAllowed: false,
      excluded: false,
    },
    onSubmit: async ({ value }) => {
      onSave(
        await save({
          ...value,
          account: session.account,
          labelName: session.labels.find((l) => l.id === value.labelId)!.name,
        })
      );
    },
  });
  return (
    <form.AppForm>
      <form.FormRoot className="space-y-2">
        <p>{session.account}</p>
        <form.AppField name="labelId">
          {(field) => (
            <field.Select
              label={m.mail_label()}
              options={session.labels.map((l) => ({
                value: l.id,
                label: l.name,
              }))}
            />
          )}
        </form.AppField>
        <form.SubmitButton>{m.mail_add_source()}</form.SubmitButton>
      </form.FormRoot>
    </form.AppForm>
  );
}

function SourcePermissions({ source }: { source: Doc<"mailSources"> }) {
  const save = useConvexMutation(api.mail.saveSource);
  const form = useAppForm({
    defaultValues: {
      bodies: source.bodies,
      threadContext: source.threadContext,
      attachments: source.attachments,
      aiAllowed: source.aiAllowed,
      excluded: source.excluded,
    },
    onSubmit: async ({ value }) => {
      await save({
        ...value,
        sourceId: source._id,
        account: source.account,
        labelId: source.labelId,
        labelName: source.labelName,
      });
    },
  });
  return (
    <form.AppForm>
      <form.FormRoot className="space-y-2">
        <form.AppField name="bodies">
          {(field) => <field.Switch label={m.mail_bodies()} />}
        </form.AppField>
        <form.AppField name="threadContext">
          {(field) => <field.Switch label={m.mail_threads()} />}
        </form.AppField>
        <form.AppField name="attachments">
          {(field) => <field.Switch label={m.mail_attachments()} />}
        </form.AppField>
        <form.AppField name="aiAllowed">
          {(field) => <field.Switch label={m.mail_ai()} />}
        </form.AppField>
        <form.AppField name="excluded">
          {(field) => <field.Switch label={m.mail_exclude()} />}
        </form.AppField>
        <p className="text-muted-foreground text-sm">{m.mail_privacy()}</p>
        <form.SubmitButton>{m.mail_save_permissions()}</form.SubmitButton>
      </form.FormRoot>
    </form.AppForm>
  );
}

function RoutineForm({ sourceId }: { sourceId?: Id<"mailSources"> }) {
  const { data: taskTypes } = taskTypeApi.useList();
  const { data: priorities } = priorityClassApi.useList();
  const create = useConvexMutation(api.mail.createRoutine);
  const form = useAppForm({
    defaultValues: {
      kind: "inbox" as "inbox" | "spam",
      taskTypeId: taskTypes[0]!._id,
      priorityClassId: priorities[0]!._id,
      batchSize: 25,
    },
    onSubmit: async ({ value }) => {
      await create({
        ...value,
        sourceId,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    },
  });
  return (
    <form.AppForm>
      <form.FormRoot className="space-y-2 rounded border p-3">
        <form.AppField name="kind">
          {(field) => (
            <field.Select
              label={m.mail_routine()}
              options={[
                { value: "inbox", label: m.mail_inbox_default() },
                { value: "spam", label: m.mail_spam_default() },
              ]}
            />
          )}
        </form.AppField>
        <form.AppField name="taskTypeId">
          {(field) => (
            <field.Select
              label={m.tasks_form_field_taskType_label()}
              options={taskTypes.map((t) => ({ value: t._id, label: t.name }))}
            />
          )}
        </form.AppField>
        <form.AppField name="priorityClassId">
          {(field) => (
            <field.Select
              label={m.tasks_form_field_priorityClass_label()}
              options={priorities.map((t) => ({ value: t._id, label: t.name }))}
            />
          )}
        </form.AppField>
        <form.AppField name="batchSize">
          {(field) => (
            <field.Input
              type="number"
              min="1"
              max="50"
              label={m.mail_batch_size()}
              onChange={(e) => field.handleChange(Number(e.target.value))}
            />
          )}
        </form.AppField>
        <form.SubmitButton>{m.mail_create_routine()}</form.SubmitButton>
      </form.FormRoot>
    </form.AppForm>
  );
}

function ActionForm({
  source,
  message,
}: {
  source: Doc<"mailSources">;
  message: Message;
}) {
  const { data: actions } = useSuspenseQuery(
    convexQuery(api.mail.actionsForThread, {
      sourceId: source._id,
      threadId: message.threadId,
    })
  );
  const { data: taskTypes } = taskTypeApi.useList();
  const { data: priorities } = priorityClassApi.useList();
  const [actionKey] = useState(() => crypto.randomUUID());
  const initialAction = actions.find((a) => a.messageId === message.id);
  const [selected, setSelected] = useState(initialAction?.actionKey ?? "new");
  const [saved, setSaved] = useState(false);
  const save = useConvexMutation(api.mail.saveAction);
  const form = useAppForm({
    defaultValues: {
      title: initialAction?.task?.title ?? message.subject,
      kind: initialAction?.kind ?? ("action" as "action" | "reply"),
      suggestedReply: initialAction?.suggestedReply ?? "",
      missingInputs: "",
      excerpt: initialAction?.excerpt ?? "",
      taskTypeId: taskTypes[0]!._id,
      priorityClassId: priorities[0]!._id,
    },
    onSubmit: async ({ value }) => {
      await save({
        ...value,
        sourceId: source._id,
        messageId: message.id,
        threadId: message.threadId,
        actionKey: selected === "new" ? actionKey : selected,
        suggestedReply: source.bodies ? value.suggestedReply : undefined,
        excerpt: source.bodies ? value.excerpt : undefined,
        missingInputs: value.missingInputs.split("\n"),
      });
      setSaved(true);
    },
  });
  return (
    <form.AppForm>
      <form.FormRoot className="space-y-2">
        <p className="text-sm">{m.mail_related_help()}</p>
        <Select
          aria-label={m.mail_action()}
          value={selected}
          onValueChange={(value) => {
            setSelected(value);
            setSaved(false);
            const existing = actions.find((a) => a.actionKey === value);
            form.setFieldValue(
              "title",
              existing?.task?.title ?? message.subject
            );
            form.setFieldValue("kind", existing?.kind ?? "action");
            form.setFieldValue(
              "suggestedReply",
              existing?.suggestedReply ?? ""
            );
            form.setFieldValue("excerpt", existing?.excerpt ?? "");
          }}
          options={[
            { value: "new", label: m.mail_new_action() },
            ...actions.map((a) => ({
              value: a.actionKey,
              label: a.task?.title ?? a.actionKey,
            })),
          ]}
        />
        <form.AppField name="title">
          {(field) => (
            <field.Input
              label={m.tasks_form_field_title_label()}
              required
            />
          )}
        </form.AppField>
        <form.AppField name="kind">
          {(field) => (
            <field.Select
              label={m.mail_action()}
              options={[
                { value: "action", label: m.mail_action() },
                { value: "reply", label: m.mail_reply_task() },
              ]}
            />
          )}
        </form.AppField>
        <form.AppField name="taskTypeId">
          {(field) => (
            <field.Select
              label={m.tasks_form_field_taskType_label()}
              options={taskTypes.map((t) => ({ value: t._id, label: t.name }))}
            />
          )}
        </form.AppField>
        <form.AppField name="priorityClassId">
          {(field) => (
            <field.Select
              label={m.tasks_form_field_priorityClass_label()}
              options={priorities.map((t) => ({ value: t._id, label: t.name }))}
            />
          )}
        </form.AppField>
        {source.bodies && (
          <>
            <form.AppField name="excerpt">
              {(field) => (
                <field.Input
                  label={m.mail_excerpt()}
                  maxLength={2000}
                />
              )}
            </form.AppField>
            <form.AppField name="suggestedReply">
              {(field) => (
                <field.Input
                  label={m.mail_reply_draft()}
                  maxLength={5000}
                />
              )}
            </form.AppField>
            <form.AppField name="missingInputs">
              {(field) => <field.Input label={m.mail_missing_inputs()} />}
            </form.AppField>
          </>
        )}
        <form.SubmitButton>{m.mail_save_action()}</form.SubmitButton>
        {saved && <p role="status">{m.mail_action_saved()}</p>}
      </form.FormRoot>
    </form.AppForm>
  );
}

function BatchProgress({ taskId }: { taskId: Id<"tasks"> }) {
  const { data: batch } = useSuspenseQuery(
    convexQuery(api.mail.batch, { taskId })
  );
  return (
    batch && (
      <p>
        {batch.manual
          ? m.mail_manual_batch()
          : m.mail_review_progress({
              reviewed: batch.reviewedIds.length,
              total: batch.messageIds.length,
            })}
      </p>
    )
  );
}

export function MailTaskDetails({ taskId }: { taskId: Id<"tasks"> }) {
  const { data } = useSuspenseQuery(
    convexQuery(api.mail.taskDetails, { taskId })
  );
  if (!data) return null;
  return (
    <div className="space-y-2 rounded border p-3">
      <a
        className="underline"
        href={`https://mail.google.com/mail/u/${encodeURIComponent(data.account)}/#all/${data.messageId}`}
        target="_blank"
        rel="noreferrer"
      >
        {m.mail_open_message()}
      </a>
      {!data.available && <p>{m.mail_unavailable()}</p>}
      {data.excerpt && <p className="whitespace-pre-wrap">{data.excerpt}</p>}
      {data.suggestedReply && (
        <pre className="whitespace-pre-wrap">{data.suggestedReply}</pre>
      )}
    </div>
  );
}
