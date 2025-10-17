import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import { addDays, endOfDay } from "date-fns";
import z from "zod";

import { api } from "@gc/convex/api";
import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { getLocale } from "@gc/i18n/runtime";
import { ErrorSuspense } from "@gc/react-kit";
import { Drawer, parseDateToString, useModal } from "@gc/ui";
import {
  ExtendedTask,
  UpdateTaskArgs,
  updateTaskZodSchema,
} from "@gc/validators";

import { usePriorityClasses } from "../priority-classes/use-priority-classes";

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

  const defaultDueAt = addDays(endOfDay(new Date()), 2);
  const defaultValues: UpdateTaskClientArgs = {
    title: editedTask.title,
    description: editedTask.description,
    priorityClassId: editedTask.priorityClassId,
    initialNumValue: editedTask.initialNumValue,
    completedNumValue: editedTask.completedNumValue,
    useDueAt: !!editedTask.dueAt,
    dueAt: editedTask.dueAt ? new Date(editedTask.dueAt) : defaultDueAt,
  };

  const form = useAppForm({
    defaultValues,
    validators: {
      onBlur: updateTaskZodSchema.safeExtend({
        useDueAt: z.boolean(),
        dueAt: updateTaskZodSchema.shape.dueAt.unwrap(),
      }),
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
        {editedTask.valueKind === "number" && (
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
        )}
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
