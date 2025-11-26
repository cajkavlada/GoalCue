import { addDays, endOfDay } from "date-fns";
import { Plus } from "lucide-react";
import z from "zod";

import { asFormValidator, useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { getLocale } from "@gc/i18n/runtime";
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
