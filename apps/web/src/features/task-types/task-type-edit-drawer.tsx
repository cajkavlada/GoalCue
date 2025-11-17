import { Plus } from "lucide-react";
import { nanoid } from "nanoid";

import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { Drawer, DrawerButton, SelectItem } from "@gc/ui";
import {
  ExtendedTaskType,
  getUpdateTaskTypeZodSchema,
  UpdateTaskTypeArgs,
} from "@gc/validators";

import { TagCreateDrawer } from "../tags/tag-create-drawer";
import { tagApi } from "../tags/tag.api";
import { TaskTypeEnumOptionsEditor } from "../task-type-enum-options/task-type-enum-options-editor";
import { UnitCreateDrawer } from "../units/unit-create-drawer";
import { unitApi } from "../units/unit.api";
import { taskTypeApi } from "./task-type.api";

export function TaskTypeEditDrawer({
  editedTaskType,
}: {
  editedTaskType: ExtendedTaskType;
}) {
  return (
    <Drawer
      title={m.taskTypes_edit_drawer_title()}
      description={m.taskTypes_edit_drawer_description()}
      customFooter
    >
      <ErrorSuspense>
        <TaskTypeEditForm editedTaskType={editedTaskType} />
      </ErrorSuspense>
    </Drawer>
  );
}

export function TaskTypeEditForm({
  editedTaskType,
}: {
  editedTaskType: ExtendedTaskType;
}) {
  const { data: units } = unitApi.useList();
  const { data: tags } = tagApi.useList();

  const { data: taskTypes } = taskTypeApi.useList();
  const updateMutation = taskTypeApi.useUpdate();

  function stripEnumOptions(
    enumOptions: NonNullable<ExtendedTaskType["taskTypeEnumOptions"]>
  ) {
    return enumOptions.map((option) => ({
      name: option.name,
      _id: option._id,
      dndId: nanoid(),
    }));
  }

  const defaultValues: UpdateTaskTypeArgs =
    editedTaskType.valueKind === "number"
      ? ({
          name: editedTaskType.name,
          valueKind: editedTaskType.valueKind,
          initialNumValue: editedTaskType.initialNumValue!,
          completedNumValue: editedTaskType.completedNumValue!,
          unitId: editedTaskType.unitId ?? "none",
          tags: editedTaskType.tags.map((tag) => tag._id),
        } as UpdateTaskTypeArgs)
      : editedTaskType.valueKind === "enum"
        ? {
            name: editedTaskType.name,
            valueKind: editedTaskType.valueKind,
            taskTypeEnumOptions: stripEnumOptions(
              editedTaskType.taskTypeEnumOptions!
            ),
            archivedTaskTypeEnumOptions: [],
            tags: editedTaskType.tags.map((tag) => tag._id),
          }
        : {
            name: editedTaskType.name,
            valueKind: editedTaskType.valueKind,
            tags: editedTaskType.tags.map((tag) => tag._id),
          };

  const form = useAppForm({
    defaultValues,
    validators: {
      onBlur: getUpdateTaskTypeZodSchema({
        existingTaskTypes: taskTypes,
        currentTaskTypeId: editedTaskType._id,
      }),
    },
    onSubmit: async ({ value }) => {
      // strip dndId from enum options
      if (value.valueKind === "enum") {
        value.taskTypeEnumOptions = value.taskTypeEnumOptions.map((option) => ({
          name: option.name,
          _id: option._id,
        }));
      }
      if (value.valueKind === "number" && value.unitId === "none") {
        value.unitId = undefined;
      }
      const { valueKind: _, ...rest } = value;
      await updateMutation.mutateAsync({
        taskTypeId: editedTaskType._id,
        ...rest,
      });
    },
  });

  return (
    <form.AppForm>
      <form.FormRoot className="flex flex-col gap-4">
        <form.AppField name="name">
          {(field) => (
            <field.Input
              label={m.taskTypes_form_field_name_label()}
              autoFocus
            />
          )}
        </form.AppField>

        {editedTaskType.valueKind === "number" && (
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
            <form.AppField name="unitId">
              {(field) => (
                <div className="flex w-full items-end gap-2">
                  <field.Select
                    className="flex-1"
                    label={m.taskTypes_form_field_unitId_label()}
                  >
                    <SelectItem value="none">
                      {m.taskTypes_form_field_unitId_none()}
                    </SelectItem>
                    {units.map((unit) => (
                      <SelectItem
                        key={unit._id}
                        value={unit._id}
                      >
                        {unit.name}
                      </SelectItem>
                    ))}
                  </field.Select>
                  <DrawerButton
                    tooltip={m.taskTypes_create_button_label()}
                    drawerContent={
                      <UnitCreateDrawer
                        onCreate={async (newUnitId) => {
                          field.handleChange(newUnitId);
                        }}
                      />
                    }
                  >
                    <Plus />
                  </DrawerButton>
                </div>
              )}
            </form.AppField>
          </div>
        )}
        {editedTaskType.valueKind === "enum" && (
          <form.AppField name="taskTypeEnumOptions">
            {(field) => (
              <TaskTypeEnumOptionsEditor
                onAddEnumOption={(option) => {
                  field.pushValue(option);
                }}
                onRemoveEnumOption={(index, optionId) => {
                  field.removeValue(index);
                  if (optionId) {
                    form.pushFieldValue(
                      "archivedTaskTypeEnumOptions",
                      optionId
                    );
                  }
                }}
                onEditEnumOption={(index, value) => {
                  field.replaceValue(index, {
                    ...field.state.value[index],
                    name: value,
                  });
                }}
              />
            )}
          </form.AppField>
        )}
        <form.AppField name="tags">
          {(field) => (
            <div className="flex w-full items-end gap-2">
              <field.MultiSelect
                className="flex-1"
                label={m.tags_form_assigned_tags_label()}
                emptyMessage={m.tags_empty_message()}
                options={tags.map((tag) => ({
                  label: tag.name,
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
