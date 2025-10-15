import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { Drawer, useModal } from "@gc/ui";
import {
  ExtendedTask,
  UpdateTaskArgs,
  updateTaskZodSchema,
} from "@gc/validators";

import { usePriorityClasses } from "../priority-classes/use-priority-classes";

export function TaskEditDrawer({ editedTask }: { editedTask: ExtendedTask }) {
  return (
    <Drawer
      title={m.tasks_update_dialog_title()}
      description={m.tasks_update_dialog_description()}
      customFooter
    >
      <ErrorSuspense>
        <TaskCreateForm editedTask={editedTask} />
      </ErrorSuspense>
    </Drawer>
  );
}

function TaskCreateForm({ editedTask }: { editedTask: ExtendedTask }) {
  const { closeDrawer } = useModal();

  const priorityClasses = usePriorityClasses();

  const updateMutation = useMutation({
    mutationFn: useConvexMutation(api.tasks.update),
    onSuccess: () => {
      closeDrawer();
    },
  });

  const defaultValues: Omit<UpdateTaskArgs, "taskId"> = {
    title: editedTask.title,
    description: editedTask.description,
    priorityClassId: editedTask.priorityClassId,
    initialNumValue: editedTask.initialNumValue,
    completedNumValue: editedTask.completedNumValue,
  };

  const form = useAppForm({
    defaultValues,
    validators: {
      onBlur: updateTaskZodSchema,
    },
    onSubmit: async ({ value }) =>
      await updateMutation.mutateAsync({ taskId: editedTask._id, ...value }),
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
        {editedTask.valueKind === "number" && (
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
        )}
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
