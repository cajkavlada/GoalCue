import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import z from "zod";

import { api } from "@gc/convex/api";
import { Doc } from "@gc/convex/types";
import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { Dialog, useDialog } from "@gc/ui";

import { usePriorityClasses } from "../priority-classes/use-priority-classes";
import { useTaskTypes } from "../task-types/use-task-types";

type Task = Doc<"tasks"> & {
  taskType: Doc<"taskTypes">;
  priorityClass: Doc<"priorityClasses">;
};

export function TaskForm({ editedTask }: { editedTask?: Task }) {
  const { closeDialog } = useDialog();

  const priorityClasses = usePriorityClasses();
  const taskTypes = useTaskTypes();

  const createTask = useMutation({
    mutationFn: useConvexMutation(api.tasks.create),
    onSuccess: () => {
      closeDialog();
    },
  });
  const updateTask = useMutation({
    mutationFn: useConvexMutation(api.tasks.update),
    onSuccess: () => {
      closeDialog();
    },
  });

  const form = useAppForm({
    defaultValues: {
      title: editedTask?.title ?? "",
      description: editedTask?.description ?? "",
      taskTypeId: editedTask?.taskTypeId ?? taskTypes[0]!._id,
      priorityClassId: editedTask?.priorityClassId ?? priorityClasses[0]!._id,
      initialNumValue:
        editedTask?.initialNumValue ?? taskTypes[0]?.initialNumValue,
      completedNumValue:
        editedTask?.completedNumValue ?? taskTypes[0]?.completedNumValue,
    },
    onSubmit: ({ value }) => {
      if (editedTask) {
        updateTask.mutate({ taskId: editedTask._id, ...value });
      } else {
        createTask.mutate(value);
      }
    },
  });

  return (
    <Dialog
      title={
        editedTask
          ? m.tasks_update_dialog_title()
          : m.tasks_create_dialog_title()
      }
      customFooter
    >
      <div>
        <form.AppForm>
          <form.FormRoot>
            <form.AppField
              name="title"
              validators={{
                onChange: z
                  .string()
                  .min(1, m.tasks_form_field_title_validation_required()),
              }}
            >
              {(field) => (
                <field.Input label={m.tasks_form_field_title_label()} />
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
                />
              )}
            </form.AppField>
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
      </div>
    </Dialog>
  );
}
