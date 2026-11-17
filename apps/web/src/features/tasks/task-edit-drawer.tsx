import { useState } from "react";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { addDays, endOfDay } from "date-fns";
import { Plus } from "lucide-react";
import z from "zod";

import { api } from "@gc/convex/api";
import { Id } from "@gc/convex/types";
import { asFormValidator, useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import {
  Button,
  Drawer,
  DrawerButton,
  parseDateToString,
  Select,
} from "@gc/ui";
import {
  ExtendedTask,
  RecurrenceRule,
  UpdateTaskArgs,
  updateTaskZodSchema,
} from "@gc/validators";

import { translatePregeneratedItem } from "../../utils/translate-pregenerated-items";
import { MailTaskDetails } from "../mail/mail-settings";
import { priorityClassApi } from "../priority-classes/priority-class.api";
import { TagCreateDrawer } from "../tags/tag-create-drawer";
import { tagApi } from "../tags/tag.api";
import { ProjectFields } from "./projects";
import { RecurrenceEditor } from "./recurrence-editor";
import { taskApi } from "./task.api";

type UpdateTaskClientArgs = Omit<UpdateTaskArgs, "dueAt"> & {
  useDueAt: boolean;
  dueAt: NonNullable<UpdateTaskArgs["dueAt"]>;
};

export function TaskEditDrawer({ editedTask }: { editedTask: ExtendedTask }) {
  return (
    <Drawer
      title={m.tasks_update_dialog_title()}
      description={m.tasks_update_dialog_description()}
      customFooter
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ErrorSuspense>
          <MailTaskDetails taskId={editedTask._id} />
          <TaskProgress taskId={editedTask._id} />
          <TaskPriority taskId={editedTask._id} />
          <TaskEditForm editedTask={editedTask} />
        </ErrorSuspense>
      </div>
    </Drawer>
  );
}

export function TaskProgress({ taskId }: { taskId: Id<"tasks"> }) {
  const setBoard = useConvexMutation(api.jira.setBalancingBoard);
  const [boardError, setBoardError] = useState("");
  const { data: task } = useSuspenseQuery(
    convexQuery(api.tasks.getExtendedById, { taskId })
  );
  const { data: sessions } = useSuspenseQuery(
    convexQuery(api.sessions.listSessions, {})
  );
  const { data: units } = useSuspenseQuery(convexQuery(api.units.list, {}));
  const { data: settings } = useSuspenseQuery(
    convexQuery(api.planning.getSettings, {})
  );
  const taskSessions = sessions.filter((session) => session.taskId === taskId);
  const recorded = taskSessions.reduce(
    (total, session) => total + (session.checkIn?.timeMinutes ?? 0),
    0
  );
  const upcoming = taskSessions
    .filter((session) => session.startAt > Date.now())
    .sort((a, b) => a.startAt - b.startAt);
  const remaining = taskSessions
    .filter((session) => session.checkIn?.remainingMinutes !== undefined)
    .sort((a, b) => b.checkIn!.reportedAt - a.checkIn!.reportedAt)[0]
    ?.checkIn?.remainingMinutes;
  const legacyUnit = units.find((unit) => unit._id === task.taskType.unitId);
  const unit =
    task.progressMeasure === "percentage"
      ? "%"
      : task.progressMeasure === "time"
        ? m.planning_minutes()
        : (task.progressUnit ??
          (legacyUnit ? translatePregeneratedItem(legacyUnit).name : ""));
  return (
    <section
      aria-label={m.check_in_current_progress()}
      className="bg-muted/30 mb-4 space-y-2 rounded-lg border p-3 text-sm"
      aria-live="polite"
    >
      <p className="text-muted-foreground text-xs">
        {m.check_in_current_progress()}
      </p>
      {task.jira && (
        <div className="space-y-2 border-b pb-2">
          <p>
            {task.jiraIdentity} · {task.jira.status} · {task.jira.assignee}
          </p>
          {/^https?:\/\//i.test(task.jira.link) && (
            <a
              className="underline"
              href={task.jira.link}
              target="_blank"
              rel="noreferrer"
            >
              {m.jira_field_link()}
            </a>
          )}
          <p>
            {m.jira_field_boards()}: {task.jiraBoards?.join(", ")}
          </p>
          <p>
            {m.jira_field_parent()}: {task.jira.parent || "—"}
          </p>
          <p>
            {m.jira_field_sprint()}: {task.jira.sprint || "—"} ·{" "}
            {task.jira.sprintEnd
              ? new Date(task.jira.sprintEnd).toISOString().slice(0, 10)
              : "—"}
          </p>
          <p>
            {m.jira_field_storyPoints()}: {task.jira.storyPoints ?? "—"}
          </p>
          <p>
            {m.jira_estimate_basis()}:{" "}
            {task.jira.estimateBasis === "remaining"
              ? m.jira_field_remainingMinutes()
              : task.jira.estimateBasis === "half-original"
                ? `${m.jira_field_estimateMinutes()} × 50%`
                : m.jira_fallback()}
          </p>
          {!!task.jiraBoards?.length && (
            <label className="block space-y-1">
              <span>{m.jira_balancing_board()}</span>
              <Select
                value={task.jiraBalancingBoard ?? task.jiraBoards[0]!}
                options={task.jiraBoards.map((board) => ({
                  value: board,
                  label: board,
                }))}
                onValueChange={async (board) => {
                  try {
                    await setBoard({ taskId, board });
                    setBoardError("");
                  } catch (error) {
                    setBoardError((error as Error).message);
                  }
                }}
              />
            </label>
          )}
          {boardError && <p role="alert">{boardError}</p>}
        </div>
      )}
      <p className="font-semibold tabular-nums">
        {task.valueKind === "number"
          ? `${task.currentNumValue ?? 0} / ${task.completedNumValue ?? "—"} ${unit}`
          : task.completedAt !== undefined
            ? m.check_in_finished()
            : m.check_in_incomplete()}
      </p>
      <p>
        {m.check_in_time()}: {recorded}
      </p>
      {remaining !== undefined && (
        <p>
          {m.check_in_remaining()}: {remaining}
        </p>
      )}
      <p>{m.planning_upcoming_sessions({ count: upcoming.length })}</p>
      {upcoming.length > 0 && (
        <ul className="text-muted-foreground space-y-1 text-xs">
          {upcoming.slice(0, 3).map((session) => (
            <li key={session._id}>
              {new Intl.DateTimeFormat(undefined, {
                timeZone: settings?.timezone,
                dateStyle: "medium",
                timeStyle: "short",
              }).format(session.startAt)}{" "}
              · {Math.round((session.endAt - session.startAt) / 60000)}{" "}
              {m.planning_minutes()}
            </li>
          ))}
        </ul>
      )}
      {task.effortMinutes === undefined &&
        remaining === undefined &&
        task.completedAt === undefined && (
          <p className="text-muted-foreground text-xs">
            {m.planning_estimate_needed()}
          </p>
        )}
    </section>
  );
}

function TaskEditForm({ editedTask }: { editedTask: ExtendedTask }) {
  const [membership, setMembership] = useState<
    Pick<UpdateTaskArgs, "projectId" | "milestoneId">
  >({
    projectId: editedTask.projectId,
    milestoneId: editedTask.milestoneId,
  });
  const { data: priorityClasses } = priorityClassApi.useList();
  const { data: tags } = tagApi.useList();

  const updateMutation = taskApi.useUpdate();
  const { data: settings } = useSuspenseQuery(
    convexQuery(api.planning.getSettings, {})
  );
  const [recurrence, setRecurrence] = useState<RecurrenceRule | undefined>(
    editedTask.recurrence
      ? {
          ...editedTask.recurrence,
          endAfter: editedTask.recurrence.endDate
            ? undefined
            : editedTask.recurrence.endAfter,
        }
      : undefined
  );
  const [editScope, setEditScope] = useState<"future" | "occurrence">("future");

  const defaultDueAt = addDays(endOfDay(new Date()), 2);
  const defaultValues: UpdateTaskClientArgs = {
    attendance: editedTask.attendance ?? "unknown",
    hybridAttendance: editedTask.hybridAttendance,
    locationRequirement: editedTask.locationRequirement ?? "",
    title: editedTask.title,
    leisure: editedTask.leisure ?? false,
    recoveryWindowDays: editedTask.recoveryWindowDays,
    effortMinutes: editedTask.effortMinutes,
    minSessionMinutes: editedTask.minSessionMinutes,
    maxSessionMinutes: editedTask.maxSessionMinutes,
    automaticSchedulingPaused: editedTask.automaticSchedulingPaused ?? false,
    priority: undefined,
    finishKind: editedTask.finishKind ?? "firm",
    progressMeasure: editedTask.progressMeasure,
    progressUnit: editedTask.progressUnit,
    description: editedTask.description,
    priorityClassId: editedTask.priorityClassId,
    initialNumValue: editedTask.initialNumValue,
    completedNumValue: editedTask.completedNumValue,
    useDueAt: !!editedTask.dueAt,
    dueAt: editedTask.dueAt ? new Date(editedTask.dueAt) : defaultDueAt,
    tags: editedTask.tags.map((tag) => tag._id),
  };

  const form = useAppForm({
    defaultValues,
    validators: {
      // temporary solution asFormValidator caused by mismatch of zod schema input and output for convex zid field
      onBlur: asFormValidator(
        updateTaskZodSchema.safeExtend({
          useDueAt: z.boolean(),
          dueAt: updateTaskZodSchema.shape.dueAt.unwrap(),
        })
      ),
    },
    onSubmit: async ({ value }) => {
      const { dueAt, useDueAt, ...rest } = value;
      await updateMutation.mutateAsync({
        taskId: editedTask._id,
        dueAt: useDueAt ? dueAt.getTime() : undefined,
        ...rest,
        recurrence,
        editScope,
        ...membership,
      });
    },
  });

  return (
    <form.AppForm>
      <form.FormRoot className="flex flex-col gap-4">
        <ProjectFields
          {...membership}
          onChange={(projectId, milestoneId) =>
            setMembership({ projectId, milestoneId })
          }
        />
        <form.AppField name="title">
          {(field) => (
            <field.Input
              label={m.tasks_form_field_title_label()}
              autoFocus
            />
          )}
        </form.AppField>
        <form.AppField name="description">
          {(field) => (
            <field.Input label={m.tasks_form_field_description_label()} />
          )}
        </form.AppField>
        <form.Subscribe selector={(state) => state.values.progressMeasure}>
          {(measure) =>
            !measure &&
            editedTask.valueKind === "number" && (
              <div>
                <div className="flex gap-2">
                  <form.AppField name="initialNumValue">
                    {(field) => (
                      <field.Input
                        type="number"
                        label={m.tasks_form_field_initialNumValue_label()}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="completedNumValue">
                    {(field) => (
                      <field.Input
                        type="number"
                        label={m.tasks_form_field_completedNumValue_label()}
                      />
                    )}
                  </form.AppField>
                </div>
                <form.FormErrors path="numValues" />
              </div>
            )
          }
        </form.Subscribe>
        <form.AppField name="attendance">
          {(field) => (
            <field.Select
              label={m.travel_attendance()}
              options={[
                { value: "unknown", label: m.travel_unknown() },
                { value: "online", label: m.travel_online() },
                { value: "physical", label: m.travel_physical() },
                { value: "hybrid", label: m.travel_hybrid() },
              ]}
            />
          )}
        </form.AppField>
        <form.Subscribe selector={(state) => state.values.attendance}>
          {(attendance) =>
            attendance === "hybrid" && (
              <form.AppField name="hybridAttendance">
                {(field) => (
                  <field.Select
                    label={m.travel_intended()}
                    options={[
                      { value: "online", label: m.travel_online() },
                      { value: "physical", label: m.travel_physical() },
                    ]}
                  />
                )}
              </form.AppField>
            )
          }
        </form.Subscribe>
        <form.AppField name="locationRequirement">
          {(field) => (
            <field.Input
              label={m.travel_location()}
              maxLength={500}
            />
          )}
        </form.AppField>
        <p className="text-muted-foreground text-xs">
          {m.travel_errands_hint()}
        </p>
        <form.AppField name="leisure">
          {(field) => <field.Switch label={m.recovery_leisure()} />}
        </form.AppField>
        <form.AppField name="recoveryWindowDays">
          {(field) => (
            <field.Input
              label={m.recovery_window()}
              type="number"
              min="1"
              max="90"
              placeholder={String(settings?.recoveryWindowDays ?? 7)}
              onChange={(e) =>
                field.handleChange(
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
            />
          )}
        </form.AppField>
        <form.AppField name="effortMinutes">
          {(field) => (
            <field.Input
              label={m.planning_effort()}
              type="number"
              min="1"
              onChange={(e) =>
                field.handleChange(
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
            />
          )}
        </form.AppField>
        <div className="grid grid-cols-2 gap-3">
          <form.AppField name="minSessionMinutes">
            {(field) => (
              <field.Input
                label={m.planning_min_session()}
                type="number"
                min="1"
                max="1440"
                placeholder="15"
                onChange={(e) =>
                  field.handleChange(
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
              />
            )}
          </form.AppField>
          <form.AppField name="maxSessionMinutes">
            {(field) => (
              <field.Input
                label={m.planning_max_session()}
                type="number"
                min="1"
                max="1440"
                placeholder="60"
                onChange={(e) =>
                  field.handleChange(
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
              />
            )}
          </form.AppField>
        </div>
        <form.AppField name="automaticSchedulingPaused">
          {(field) => <field.Switch label={m.planning_pause_automatic()} />}
        </form.AppField>
        <form.AppField
          name="progressMeasure"
          listeners={{
            onChange: ({ value }) => {
              form.setFieldValue(
                "initialNumValue",
                value === "done" ? undefined : 0
              );
              form.setFieldValue(
                "completedNumValue",
                value === "done"
                  ? undefined
                  : value === "percentage"
                    ? 100
                    : value === "time"
                      ? 60
                      : 10
              );
            },
          }}
        >
          {(field) => (
            <field.Select
              label={m.planning_measure()}
              placeholder={m.planning_legacy()}
              options={[
                { label: m.planning_done(), value: "done" },
                { label: m.planning_time(), value: "time" },
                { label: m.planning_percentage(), value: "percentage" },
                { label: m.planning_quantity(), value: "quantity" },
              ]}
            />
          )}
        </form.AppField>
        <form.Subscribe selector={(state) => state.values.progressMeasure}>
          {(measure) =>
            measure &&
            measure !== "done" && (
              <>
                {measure !== "percentage" && (
                  <form.AppField name="completedNumValue">
                    {(field) => (
                      <field.Input
                        label={m.planning_target()}
                        type="number"
                        min="1"
                      />
                    )}
                  </form.AppField>
                )}
                {measure === "quantity" && (
                  <form.AppField name="progressUnit">
                    {(field) => <field.Input label={m.planning_unit()} />}
                  </form.AppField>
                )}
              </>
            )
          }
        </form.Subscribe>
        <form.AppField name="useDueAt">
          {(field) => (
            <field.Switch label={m.tasks_form_field_useDueAt_label()} />
          )}
        </form.AppField>
        <form.Subscribe selector={(state) => state.values.useDueAt}>
          {(useDueAt) =>
            useDueAt && (
              <>
                <form.AppField name="finishKind">
                  {(field) => (
                    <field.Select
                      label={m.planning_finish_kind()}
                      options={[
                        { label: m.planning_firm(), value: "firm" },
                        { label: m.planning_preferred(), value: "preferred" },
                      ]}
                    />
                  )}
                </form.AppField>
                <form.AppField name="dueAt">
                  {(field) => (
                    <field.DatePicker
                      label={m.tasks_form_field_dueAt_label()}
                      defaultTime="end-of-day"
                      initialInputValue={parseDateToString(
                        editedTask.dueAt
                          ? new Date(editedTask.dueAt)
                          : defaultDueAt,
                        "full"
                      )}
                    />
                  )}
                </form.AppField>
              </>
            )
          }
        </form.Subscribe>
        <form.AppField name="priorityClassId">
          {(field) => (
            <field.Select
              label={m.tasks_form_field_priorityClass_label()}
              options={priorityClasses.map((priorityClass) => ({
                label: priorityClass.name,
                value: priorityClass._id,
              }))}
            />
          )}
        </form.AppField>
        <form.AppField name="tags">
          {(field) => (
            <div className="flex w-full items-end gap-2">
              <field.MultiSelect
                className="flex-1"
                label={m.tags_form_assigned_tags_label()}
                emptyMessage={m.tags_empty_message()}
                options={tags.map((tag) => ({
                  label: tag.name,
                  color: tag.color,
                  value: tag._id,
                }))}
              />
              <DrawerButton
                tooltip={m.tags_create_button_label()}
                drawerContent={
                  <TagCreateDrawer
                    onCreate={(newTagId) => {
                      field.pushValue(newTagId);
                    }}
                  />
                }
              >
                <Plus />
              </DrawerButton>
            </div>
          )}
        </form.AppField>
        {editedTask.seriesId && (
          <label>
            {m.recurrence_edit_scope()}
            <Select
              value={editScope}
              onValueChange={setEditScope}
              options={[
                { value: "future", label: m.recurrence_future() },
                { value: "occurrence", label: m.recurrence_only() },
              ]}
            />
          </label>
        )}
        <form.Subscribe
          selector={(state) =>
            [state.values.progressMeasure, state.values.progressUnit] as const
          }
        >
          {([measure, unit]) => (
            <RecurrenceEditor
              progressMeasure={measure}
              progressUnit={unit}
              unitId={editedTask.taskType.unitId}
              value={recurrence}
              onChange={setRecurrence}
              timezone={
                settings?.timezone ??
                Intl.DateTimeFormat().resolvedOptions().timeZone
              }
              weekStartsOn={settings?.weekStartsOn}
              disabled={!!editedTask.seriesId && editScope === "occurrence"}
            />
          )}
        </form.Subscribe>
        <Drawer.Footer>
          <form.SubmitButton />
        </Drawer.Footer>
      </form.FormRoot>
    </form.AppForm>
  );
}

function TaskPriority({ taskId }: { taskId: Id<"tasks"> }) {
  const { data } = useSuspenseQuery(
    convexQuery(api.tasks.explainPriority, { taskId })
  );
  const setPriority = useConvexMutation(api.tasks.setPriority);
  const correct = useConvexMutation(api.tasks.correctPriority);
  const remove = useConvexMutation(api.chat.removePreference);
  const [error, setError] = useState("");
  const labels = {
    low: m.planning_low(),
    normal: m.planning_normal(),
    high: m.planning_high(),
    critical: m.planning_critical(),
  };
  const form = useAppForm({
    defaultValues: { priority: data.current, automatic: data.automatic },
    onSubmit: async ({ value }) => {
      try {
        await setPriority({
          taskId,
          automatic: value.automatic,
          priority: value.priority,
        });
        setError("");
      } catch (error) {
        setError((error as Error).message);
      }
    },
  });
  return (
    <section
      className="mb-4 space-y-2 rounded-lg border p-3 text-sm"
      aria-label={m.planning_priority()}
    >
      <p>
        {m.planning_priority()}: {labels[data.current]}
      </p>
      <p>{m.priority_suggestion({ priority: labels[data.priority] })}</p>
      <p>{m.priority_manual()}</p>
      <p>{m.priority_signals()}</p>
      {data.signals.length ? (
        <ul>
          {data.signals.map((signal, index) => (
            <li key={index}>
              {signal.kind === "project"
                ? m.projects_project()
                : signal.kind === "milestone"
                  ? m.projects_milestone()
                  : m.priority_correction()}
              :{" "}
              {signal.kind === "correction"
                ? m.priority_correction()
                : signal.title}{" "}
              — {labels[signal.priority]}
            </li>
          ))}
        </ul>
      ) : (
        <p>{m.priority_default()}</p>
      )}
      <p>{m.priority_urgency()}</p>
      <p>{m.priority_remaining({ minutes: data.remainingMinutes })}</p>
      {data.dueAt !== undefined && (
        <p>
          {data.finishKind === "firm"
            ? m.planning_firm()
            : m.planning_preferred()}
          : {new Date(data.dueAt).toLocaleString()}
        </p>
      )}
      <form.AppForm>
        <form.FormRoot className="space-y-2">
          <form.AppField name="automatic">
            {(field) => <field.Switch label={m.priority_automatic()} />}
          </form.AppField>
          <form.AppField
            name="priority"
            listeners={{
              onChange: () => form.setFieldValue("automatic", false),
            }}
          >
            {(field) => (
              <field.Select
                label={m.planning_priority()}
                options={(Object.keys(labels) as (keyof typeof labels)[]).map(
                  (value) => ({ value, label: labels[value] })
                )}
              />
            )}
          </form.AppField>
          <form.SubmitButton />
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                await correct({
                  taskId,
                  priority: form.getFieldValue("priority"),
                });
                form.setFieldValue("automatic", false);
                setError("");
              } catch (error) {
                setError((error as Error).message);
              }
            }}
          >
            {m.priority_correct()}
          </Button>
        </form.FormRoot>
      </form.AppForm>
      <h3>{m.priority_preferences()}</h3>
      <ul>
        {data.preferences.map((preference) => (
          <li
            key={preference._id}
            className="flex items-center justify-between gap-2"
          >
            <span>
              {m.priority_correction()}:{" "}
              {preference.priority && labels[preference.priority]}
            </span>
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                try {
                  await remove({ id: preference._id });
                  setError("");
                } catch (error) {
                  setError((error as Error).message);
                }
              }}
            >
              {m.delete()}
            </Button>
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
