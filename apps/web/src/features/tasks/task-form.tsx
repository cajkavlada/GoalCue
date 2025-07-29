import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { Doc } from "@gc/convex/types";
import { useAppForm } from "@gc/form";

type Task = Doc<"tasks"> & {
  taskType: Doc<"taskTypes">;
  priorityClass: Doc<"priorityClasses">;
};

export function TaskForm({ editedTask }: { editedTask?: Task }) {
  const { data: priorityClasses } = useSuspenseQuery(
    convexQuery(api.tasks.getPriorityClasses, {})
  );
  const { data: taskTypes } = useSuspenseQuery(
    convexQuery(api.tasks.getTaskTypes, {})
  );
  const createTask = useMutation({
    mutationFn: useConvexMutation(api.tasks.createTask),
  });
  const updateTask = useMutation({
    mutationFn: useConvexMutation(api.tasks.updateTask),
  });

  const form = useAppForm({
    defaultValues: {
      title: editedTask?.title ?? "",
      description: editedTask?.description ?? "",
      taskTypeId: editedTask?.taskTypeId ?? taskTypes[0]!._id,
      priorityClassId: editedTask?.priorityClassId ?? priorityClasses[0]!._id,
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
    <div>
      <form.AppForm>
        <form.FormRoot>
          <form.AppField name="title">
            {(field) => <field.Input label="Title" />}
          </form.AppField>
          <form.AppField name="description">
            {(field) => <field.Input label="Description" />}
          </form.AppField>
          <form.AppField name="taskTypeId">
            {(field) => (
              <field.Select
                label="Task Type"
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
                label="Priority Class"
                options={priorityClasses.map((priorityClass) => ({
                  label: priorityClass.name,
                  value: priorityClass._id,
                }))}
              />
            )}
          </form.AppField>
          <form.SubmitButton showSubmitResponse>Create task</form.SubmitButton>
        </form.FormRoot>
      </form.AppForm>
    </div>
  );
}
