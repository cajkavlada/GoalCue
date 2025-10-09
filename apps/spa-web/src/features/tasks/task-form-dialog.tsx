import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { Dialog, useDialog } from "@gc/ui";
import {
  CreateTaskArgs,
  createTaskZodSchema,
  ExtendedTask,
} from "@gc/validators";

import { usePriorityClasses } from "../priority-classes/use-priority-classes";
import { useTaskTypes } from "../task-types/use-task-types";

export function TaskFormDialog({ editedTask }: { editedTask?: ExtendedTask }) {
  return (
    <Dialog
      title={
        editedTask
          ? m.tasks_update_dialog_title()
          : m.tasks_create_dialog_title()
      }
      description={
        editedTask
          ? m.tasks_update_dialog_description()
          : m.tasks_create_dialog_description()
      }
      customFooter
    >
      <ErrorSuspense>
        <TaskForm editedTask={editedTask} />
      </ErrorSuspense>
    </Dialog>
  );
}

function TaskForm({ editedTask }: { editedTask?: ExtendedTask }) {
  const { closeDialog } = useDialog();

  const priorityClasses = usePriorityClasses();
  const taskTypes = useTaskTypes();

  const createMutation = useMutation({
    mutationFn: useConvexMutation(api.tasks.create),
    onSuccess: () => {
      closeDialog();
    },
  });
  const updateMutation = useMutation({
    mutationFn: useConvexMutation(api.tasks.update),
    onSuccess: () => {
      closeDialog();
    },
  });

  const defaultValues: CreateTaskArgs = {
    title: editedTask?.title ?? "",
    description: editedTask?.description,
    taskTypeId: editedTask?.taskTypeId ?? taskTypes[0]!._id,
    priorityClassId: editedTask?.priorityClassId ?? priorityClasses[0]!._id,
    initialNumValue:
      editedTask?.initialNumValue ?? taskTypes[0]?.initialNumValue,
    completedNumValue:
      editedTask?.completedNumValue ?? taskTypes[0]?.completedNumValue,
  };

  const form = useAppForm({
    defaultValues,
    validators: {
      onBlur: createTaskZodSchema,
    },
    onSubmit: async ({ value }) => {
      if (editedTask) {
        await updateMutation.mutateAsync({ taskId: editedTask._id, ...value });
      } else {
        await createMutation.mutateAsync(value);
      }
    },
  });

  return (
    <form.AppForm>
      <form.FormRoot>
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
        <form.AppField name="taskTypeId">
          {(field) => (
            <field.Select
              label={m.tasks_form_field_taskType_label()}
              options={taskTypes.map((taskType) => ({
                label: taskType.name,
                value: taskType._id,
              }))}
              onValueChange={(taskTypeId) => {
                const taskType = taskTypes.find((t) => t._id === taskTypeId);
                const isNumber = taskType?.valueKind === "number";
                form.setFieldValue(
                  "initialNumValue",
                  isNumber ? (taskType?.initialNumValue ?? 0) : undefined
                );
                form.setFieldValue(
                  "completedNumValue",
                  isNumber ? (taskType?.completedNumValue ?? 10) : undefined
                );
              }}
            />
          )}
        </form.AppField>
        <form.Subscribe selector={(state) => state.values.taskTypeId}>
          {(taskTypeId) => {
            function isNumberTaskType(taskTypeId: string) {
              const taskType = taskTypes.find((t) => t._id === taskTypeId);
              return taskType?.valueKind === "number";
            }
            return (
              isNumberTaskType(taskTypeId) && (
                <>
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
                </>
              )
            );
          }}
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
        <Dialog.Footer>
          <form.SubmitButton showSubmitResponse />
        </Dialog.Footer>
      </form.FormRoot>
    </form.AppForm>
  );
}
