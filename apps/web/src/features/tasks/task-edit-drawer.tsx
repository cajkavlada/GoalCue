import { addDays, endOfDay } from "date-fns";
import { Plus } from "lucide-react";
import z from "zod";

import { asFormValidator, useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { Drawer, DrawerButton, parseDateToString } from "@gc/ui";
import {
  ExtendedTask,
  UpdateTaskArgs,
  updateTaskZodSchema,
} from "@gc/validators";

import { priorityClassApi } from "../priority-classes/priority-class.api";
import { TagCreateDrawer } from "../tags/tag-create-drawer";
import { tagApi } from "../tags/tag.api";
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
      <ErrorSuspense>
        <TaskEditForm editedTask={editedTask} />
      </ErrorSuspense>
    </Drawer>
  );
}

function TaskEditForm({ editedTask }: { editedTask: ExtendedTask }) {
  const { data: priorityClasses } = priorityClassApi.useList();
  const { data: tags } = tagApi.useList();

  const updateMutation = taskApi.useUpdate();

  const defaultDueAt = addDays(endOfDay(new Date()), 2);
  const defaultValues: UpdateTaskClientArgs = {
    title: editedTask.title,
    effortMinutes: editedTask.effortMinutes,
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
      });
    },
  });

  return (
    <form.AppForm>
      <form.FormRoot className="flex flex-col gap-4">
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
        <Drawer.Footer>
          <form.SubmitButton />
        </Drawer.Footer>
      </form.FormRoot>
    </form.AppForm>
  );
}
