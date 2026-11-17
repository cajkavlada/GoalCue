import { useRef, useState } from "react";
import { useConvexMutation as useMutation } from "@convex-dev/react-query";

import { useAction, useQuery } from "@gc/convex";
import { api } from "@gc/convex/api";
import { Id } from "@gc/convex/types";
import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { Button, Select, Switch } from "@gc/ui";

type Message = { role: string; text: string };

export function PlanningChat() {
  const lastRequest = useRef<{ text: string; id: string } | undefined>(
    undefined
  );
  const [temporary, setTemporary] = useState(false);
  const [conversationId, setConversationId] =
    useState<Id<"chatConversations">>();
  const [local, setLocal] = useState<Message[]>([]);
  const [operationId, setOperationId] = useState<Id<"chatOperations">>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const conversations = useQuery(api.chat.list, {});
  const history = useQuery(
    api.chat.history,
    conversationId && !temporary ? { conversationId } : "skip"
  );
  const preferences = useQuery(api.chat.preferences, {});
  const lastOperation = useQuery(
    api.chat.lastOperation,
    conversationId && !temporary ? { conversationId } : "skip"
  );
  const activeOperationId = operationId ?? lastOperation ?? undefined;
  const operation = useQuery(
    api.chat.operation,
    activeOperationId ? { id: activeOperationId } : "skip"
  );
  const status = useQuery(api.ai.status, {});
  const send = useAction(api.chatActions.send);
  const create = useMutation(api.chat.create);
  const remove = useMutation(api.chat.remove);
  const confirm = useMutation(api.chat.confirm);
  const undo = useMutation(api.chat.undo);
  const savePreference = useMutation(api.chat.savePreference);
  const removePreference = useMutation(api.chat.removePreference);
  const form = useAppForm({
    defaultValues: { text: "" },
    onSubmit: async ({ value }) => {
      if (!value.text.trim() || busy) return;
      setBusy(true);
      setError("");
      setOperationId(undefined);
      const requestId =
        lastRequest.current?.text === value.text
          ? lastRequest.current.id
          : crypto.randomUUID();
      lastRequest.current = { text: value.text, id: requestId };
      try {
        const id = temporary
          ? undefined
          : (conversationId ?? (await create({})));
        if (id) setConversationId(id);
        if (temporary)
          setLocal((messages) => [
            ...messages,
            { role: "user", text: value.text },
          ]);
        const response = await send({
          text: value.text,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          conversationId: id,
          requestId,
          attemptId: crypto.randomUUID(),
          previousUserText: temporary
            ? local
                .filter((r) => r.role === "user")
                .slice(-2)
                .map((r) => r.text)
                .join("\n")
                .slice(-2000)
            : undefined,
        });
        if (temporary)
          setLocal((messages) => [
            ...messages,
            { role: "assistant", text: response.text },
          ]);
        setOperationId(response.operationId);
        lastRequest.current = undefined;
        form.reset();
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : m.chat_error());
      } finally {
        setBusy(false);
      }
    },
  });
  const preferenceForm = useAppForm({
    defaultValues: { text: "" },
    onSubmit: async ({ value }) => {
      try {
        await savePreference({ text: value.text });
        preferenceForm.reset();
      } catch (failure) {
        setError(String(failure));
      }
    },
  });
  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }
  function switchChat(id?: Id<"chatConversations">) {
    lastRequest.current = undefined;
    setConversationId(id);
    setLocal([]);
    setOperationId(undefined);
    setError("");
  }
  return (
    <div className="mx-auto max-h-[65vh] w-full max-w-3xl space-y-3 overflow-auto p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          <Switch
            checked={temporary}
            disabled={busy}
            onCheckedChange={(value) => {
              setTemporary(value);
              switchChat();
            }}
          />
          {m.chat_temporary()}
        </label>
        {!temporary && (
          <Select
            value={conversationId ?? "new"}
            onValueChange={(value) => {
              if (!busy)
                switchChat(
                  value === "new"
                    ? undefined
                    : (value as Id<"chatConversations">)
                );
            }}
            options={[
              { value: "new", label: m.chat_new() },
              ...(conversations ?? []).map((c) => ({
                value: c._id,
                label:
                  m.chat_title() +
                  " · " +
                  new Date(c._creationTime).toLocaleString(),
              })),
            ]}
          />
        )}
        {!temporary && conversationId && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                const id = conversationId;
                switchChat();
                await remove({ conversationId: id });
              })
            }
          >
            {m.chat_delete()}
          </Button>
        )}
      </div>
      {temporary && (
        <p className="text-muted-foreground text-sm">
          {m.chat_temporary_help()}
        </p>
      )}
      {!status?.enabled && <p role="status">{m.chat_setup()}</p>}
      <div
        role="log"
        aria-live="polite"
        className="space-y-2"
      >
        {(temporary ? local : (history ?? [])).map((message, i) => (
          <p
            key={i}
            className="whitespace-pre-wrap rounded border p-2 text-sm"
          >
            <strong>
              {message.role === "user" ? m.chat_you() : m.chat_assistant()}
              :{" "}
            </strong>
            {message.text}
          </p>
        ))}
      </div>
      {operation && (
        <div className="space-y-2 rounded border p-2">
          {operation.status === "pending" && (
            <>
              <p>{m.chat_preview()}</p>
              {(operation.tool === "removeMailSource" ||
                operation.tool === "removeCalendarSource") && (
                <p>{m.chat_source_warning()}</p>
              )}
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {operation.preview.map((item, i) => (
                  <div
                    key={i}
                    className="contents"
                  >
                    <dt className="font-medium">{item.field}</dt>
                    <dd className="break-words">{item.value}</dd>
                  </div>
                ))}
              </dl>
              <Button
                disabled={busy}
                onClick={() => void act(() => confirm({ id: operation.id }))}
              >
                {m.chat_confirm()}
              </Button>
            </>
          )}
          {operation.status === "applied" && (
            <>
              <p>{m.chat_applied()}</p>
              {operation.canUndo && (
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => void act(() => undo({ id: operation.id }))}
                >
                  {m.chat_undo()}
                </Button>
              )}
            </>
          )}
          {operation.status === "undone" && <p>{m.chat_undone()}</p>}
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="text-destructive whitespace-pre-wrap"
        >
          {error}
        </p>
      )}
      <form.AppForm>
        <form.FormRoot className="flex items-end gap-2">
          <form.AppField name="text">
            {(field) => (
              <field.Input
                label={m.chat_message()}
                maxLength={2000}
                disabled={busy || !status?.enabled}
              />
            )}
          </form.AppField>
          <form.SubmitButton>{m.chat_send()}</form.SubmitButton>
        </form.FormRoot>
      </form.AppForm>
      {!temporary && (
        <details>
          <summary>{m.chat_preferences()}</summary>
          <ul>
            {preferences?.map((p) => (
              <li
                key={p._id}
                className="flex items-center justify-between gap-2"
              >
                <span>{p.text}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void act(() => removePreference({ id: p._id }))
                  }
                >
                  {m.chat_remove()}
                </Button>
              </li>
            ))}
          </ul>
          <preferenceForm.AppForm>
            <preferenceForm.FormRoot className="flex items-end gap-2">
              <preferenceForm.AppField name="text">
                {(field) => (
                  <field.Input
                    label={m.chat_preference()}
                    maxLength={1000}
                  />
                )}
              </preferenceForm.AppField>
              <preferenceForm.SubmitButton>
                {m.chat_save_preference()}
              </preferenceForm.SubmitButton>
            </preferenceForm.FormRoot>
          </preferenceForm.AppForm>
        </details>
      )}
    </div>
  );
}
