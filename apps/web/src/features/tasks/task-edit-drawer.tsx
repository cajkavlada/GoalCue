import { useState } from "react";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { addDays, endOfDay } from "date-fns";
import { Plus } from "lucide-react";
import z from "zod";

import { api } from "@gc/convex/api";
import { Id } from "@gc/convex/types";
import { asFormValidator, useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { Drawer, DrawerButton, parseDateToString, Select } from "@gc/ui";
import {
  ExtendedTask,
  RecurrenceRule,
  UpdateTaskArgs,
  updateTaskZodSchema,
} from "@gc/validators";

import { translatePregeneratedItem } from "../../utils/translate-pregenerated-items";
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
          <TaskProgress taskId={editedTask._id} />
          <TaskEditForm editedTask={editedTask} />
        </ErrorSuspense>
      </div>
    </Drawer>
  );
}

export function TaskProgress({ taskId }: { taskId: Id<"tasks"> }) {
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
    title: editedTask.title,
    effortMinutes: editedTask.effortMinutes,
    minSessionMinutes: editedTask.minSessionMinutes,
    maxSessionMinutes: editedTask.maxSessionMinutes,
    automaticSchedulingPaused: editedTask.automaticSchedulingPaused ?? false,
    priority: editedTask.priority ?? "normal",
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
        <form.AppField name="priority">
          {(field) => (
            <field.Select
              label={m.planning_priority()}
              options={["low", "normal", "high", "critical"].map((value) => ({
                label: {
                  low: m.planning_low(),
                  normal: m.planning_normal(),
                  high: m.planning_high(),
                  critical: m.planning_critical(),
                }[value as "low" | "normal" | "high" | "critical"],
                value,
              }))}
            />
          )}
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
