import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import { addDays, endOfDay } from "date-fns";
import { Plus } from "lucide-react";
import z from "zod";

import { api } from "@gc/convex/api";
import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { getLocale } from "@gc/i18n/runtime";
import { ErrorSuspense } from "@gc/react-kit";
import { Drawer, DrawerButton, parseDateToString, useModal } from "@gc/ui";
import { CreateTaskArgs, createTaskZodSchema } from "@gc/validators";

import { usePriorityClasses } from "../priority-classes/use-priority-classes";
import { TaskTypeCreateDrawer } from "../task-types/task-type-create-drawer";
import { useTaskTypes } from "../task-types/use-task-types";

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
  const { closeDrawer } = useModal();

  const { data: priorityClasses } = usePriorityClasses();
  const { data: taskTypes } = useTaskTypes();

  const createMutation = useMutation({
    mutationFn: useConvexMutation(api.tasks.create),
    onSuccess: () => {
      closeDrawer();
    },
  });

  const defaultDueAt = addDays(endOfDay(new Date()), 2);
  const defaultValues: CreateTaskClientArgs = {
    title: "",
    taskTypeId: taskTypes[0]!._id,
    priorityClassId: priorityClasses[0]!._id,
    initialNumValue: taskTypes[0]?.initialNumValue,
    completedNumValue: taskTypes[0]?.completedNumValue,
    useDueAt: false,
    dueAt: defaultDueAt,
  };

  const form = useAppForm({
    defaultValues,
    validators: {
      onBlur: createTaskZodSchema.safeExtend({
        useDueAt: z.boolean(),
        dueAt: createTaskZodSchema.shape.dueAt.unwrap(),
      }),
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
    form.setFieldValue(
      "initialNumValue",
      isNumber ? (taskType?.initialNumValue ?? 0) : undefined
    );
    form.setFieldValue(
      "completedNumValue",
      isNumber ? (taskType?.completedNumValue ?? 10) : undefined
    );
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
        <form.Subscribe selector={(state) => state.values.taskTypeId}>
          {(taskTypeId) => {
            const taskType = taskTypes.find((t) => t._id === taskTypeId);
            return (
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
            <field.Select
              label={m.tasks_form_field_priorityClass_label()}
              options={priorityClasses.map((priorityClass) => ({
                label: priorityClass.name,
                value: priorityClass._id,
              }))}
            />
          )}
        </form.AppField>
        <Drawer.Footer>
          <form.SubmitButton />
        </Drawer.Footer>
      </form.FormRoot>
    </form.AppForm>
  );
}
