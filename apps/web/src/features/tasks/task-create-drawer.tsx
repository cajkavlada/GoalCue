import { addDays, endOfDay } from "date-fns";
import { Plus } from "lucide-react";
import z from "zod";

import { asFormValidator, useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { getLocale } from "@gc/i18n/runtime";
import { ErrorSuspense } from "@gc/react-kit";
import { Drawer, DrawerButton, parseDateToString } from "@gc/ui";
import { CreateTaskArgs, createTaskZodSchema } from "@gc/validators";

import { PriorityClassCreateDrawer } from "../priority-classes/priority-class-create-drawer";
import { priorityClassApi } from "../priority-classes/priority-class.api";
import { TagCreateDrawer } from "../tags/tag-create-drawer";
import { tagApi } from "../tags/tag.api";
import { TaskTypeCreateDrawer } from "../task-types/task-type-create-drawer";
import { taskTypeApi } from "../task-types/task-type.api";
import { taskApi } from "./task.api";

type CreateTaskClientArgs = Omit<CreateTaskArgs, "dueAt"> & {
  useDueAt: boolean;
  dueAt: NonNullable<CreateTaskArgs["dueAt"]>;
};

export function TaskCreateDrawer() {
  return (
    <Drawer
      title={m.tasks_create_dialog_title()}
      description={m.tasks_create_dialog_description()}
      customFooter
    >
      <ErrorSuspense>
        <TaskCreateForm />
      </ErrorSuspense>
    </Drawer>
  );
}

function TaskCreateForm() {
  const { data: priorityClasses } = priorityClassApi.useList();
  const { data: taskTypes } = taskTypeApi.useList();
  const { data: tags } = tagApi.useList();

  const createMutation = taskApi.useCreate();

  const defaultDueAt = addDays(endOfDay(new Date()), 2);
  const defaultValues: CreateTaskClientArgs = {
    title: "",
    effortMinutes: undefined,
    priority: "normal",
    finishKind: "firm",
    progressMeasure: undefined,
    progressUnit: undefined,
    taskTypeId: taskTypes[0]!._id,
    priorityClassId: priorityClasses[0]!._id,
    initialNumValue: taskTypes[0]?.initialNumValue,
    completedNumValue: taskTypes[0]?.completedNumValue,
    useDueAt: false,
    dueAt: defaultDueAt,
    tags: taskTypes[0]?.tags.map((tag) => tag._id) ?? [],
  };

  const form = useAppForm({
    defaultValues,
    validators: {
      // temporary solution asFormValidator caused by mismatch of zod schema input and output for convex zid field
      onBlur: asFormValidator(
        createTaskZodSchema.safeExtend({
          useDueAt: z.boolean(),
          dueAt: createTaskZodSchema.shape.dueAt.unwrap(),
        })
      ),
    },
    onSubmit: async ({ value }) => {
      const { dueAt, useDueAt, ...rest } = value;
      await createMutation.mutateAsync({
        dueAt: useDueAt ? dueAt.getTime() : undefined,
        ...rest,
      });
    },
  });

  function onTaskTypeChange({
    value,
  }: {
    value: CreateTaskArgs["taskTypeId"];
  }) {
    const taskType = taskTypes.find((t) => t._id === value);
    const isNumber = taskType?.valueKind === "number";
    if (form.state.values.progressMeasure) {
      form.setFieldValue("tags", taskType?.tags.map((tag) => tag._id) ?? []);
      return;
    }
    form.setFieldValue(
      "initialNumValue",
      isNumber ? (taskType?.initialNumValue ?? 0) : undefined
    );
    form.setFieldValue(
      "completedNumValue",
      isNumber ? (taskType?.completedNumValue ?? 10) : undefined
    );
    form.setFieldValue("tags", taskType?.tags.map((tag) => tag._id) ?? []);
  }

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
        <form.AppField
          name="taskTypeId"
          listeners={{ onChange: onTaskTypeChange }}
        >
          {(field) => (
            <div className="flex w-full items-end gap-2">
              <field.Select
                className="flex-1"
                label={m.tasks_form_field_taskType_label()}
                options={taskTypes.map((taskType) => ({
                  label: taskType.name,
                  value: taskType._id,
                }))}
              />
              <DrawerButton
                tooltip={m.taskTypes_create_button_label()}
                drawerContent={
                  <TaskTypeCreateDrawer
                    onCreate={(newTaskTypeId) => {
                      field.handleChange(newTaskTypeId);
                    }}
                  />
                }
              >
                <Plus />
              </DrawerButton>
            </div>
          )}
        </form.AppField>
        <form.Subscribe
          selector={(state) =>
            [state.values.taskTypeId, state.values.progressMeasure] as const
          }
        >
          {([taskTypeId, measure]) => {
            const taskType = taskTypes.find((t) => t._id === taskTypeId);
            return (
              !measure &&
              taskType?.valueKind === "number" && (
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
            );
          }}
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
                    initialInputValue={
                      getLocale() === "en"
                        ? "In 2 days"
                        : parseDateToString(defaultDueAt, "full")
                    }
                  />
                )}
              </form.AppField>
            )
          }
        </form.Subscribe>
        <form.AppField name="priorityClassId">
          {(field) => (
            <div className="flex w-full items-end gap-2">
              <field.Select
                className="flex-1"
                label={m.tasks_form_field_priorityClass_label()}
                options={priorityClasses.map((priorityClass) => ({
                  label: priorityClass.name,
                  value: priorityClass._id,
                }))}
              />
              <DrawerButton
                tooltip={m.priorityClasses_create_button_label()}
                drawerContent={
                  <PriorityClassCreateDrawer
                    onCreate={(newPriorityClassId) => {
                      field.handleChange(newPriorityClassId);
                    }}
                  />
                }
              >
                <Plus />
              </DrawerButton>
            </div>
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
