import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import z from "zod";

import { api } from "@gc/convex/api";
import { Doc, Id } from "@gc/convex/types";
import { useAppForm } from "@gc/form";
import { Dialog, useDialog } from "@gc/ui";

import { m } from "@/paraglide/messages";

type Task = Doc<"tasks"> & {
  taskType: Doc<"taskTypes">;
  priorityClass: Doc<"priorityClasses">;
};

type TaskTypeWithUnit = Doc<"taskTypes"> & {
  unit: Doc<"units">;
};

export function TaskForm({ editedTask }: { editedTask?: Task }) {
  const { closeDialog } = useDialog();
  const { data: priorityClasses } = useSuspenseQuery(
    convexQuery(api.priorityClasses.getAllForUserId, {})
  );
  const { data: taskTypes } = useSuspenseQuery(
    convexQuery(api.taskTypes.getAllWithUnitsForUserId, {})
  );
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
      initialValue:
        editedTask?.initialValue ??
        taskTypes[0]?.initialValue ??
        getTaskTypeInitialValue(taskTypes[0]!),
      completedValue:
        editedTask?.completedValue ??
        taskTypes[0]?.completedValue ??
        getTaskTypeCompletedValue(taskTypes[0]!),
    },
    onSubmit: ({ value }) => {
      if (editedTask) {
        updateTask.mutate({ taskId: editedTask._id, ...value });
      } else {
        createTask.mutate(value);
      }
    },
  });

  function getTaskTypeInitialValue(taskType: TaskTypeWithUnit) {
    const valueType = taskType.unit?.valueType;
    return taskType.initialValue ?? (valueType === "number" ? 0 : false);
  }

  function getTaskTypeCompletedValue(taskType: TaskTypeWithUnit) {
    const valueType = taskType.unit?.valueType;
    return taskType.completedValue ?? (valueType === "number" ? 100 : true);
  }

  function onTaskTypeChange({ value }: { value: Id<"taskTypes"> }) {
    const taskType = taskTypes.find((taskType) => taskType._id === value);
    if (!taskType) throw new Error("Task type not found");
    form.setFieldValue("initialValue", getTaskTypeInitialValue(taskType));
    form.setFieldValue("completedValue", getTaskTypeCompletedValue(taskType));
  }

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
            <form.AppField
              name="taskTypeId"
              listeners={{ onChange: onTaskTypeChange }}
            >
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
