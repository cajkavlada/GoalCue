import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import { nanoid } from "nanoid";

import { api } from "@gc/convex/api";
import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { Drawer, SelectItem, useModal } from "@gc/ui";
import {
  ExtendedTaskType,
  UpdateTaskTypeArgs,
  updateTaskTypeZodSchema,
} from "@gc/validators";

import { TaskTypeEnumOptionsEditor } from "../task-type-enum-options/task-type-enum-options-editor";
import { useUnits } from "../units/use-units";

export function TaskTypeEditDrawer({
  editedTaskType,
}: {
  editedTaskType: ExtendedTaskType;
}) {
  const { closeDrawer } = useModal();

  const { data: units } = useUnits();

  const updateMutation = useMutation({
    mutationFn: useConvexMutation(api.taskTypes.update),
    onSuccess: () => {
      closeDrawer();
    },
  });

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
        } as UpdateTaskTypeArgs)
      : editedTaskType.valueKind === "enum"
        ? {
            name: editedTaskType.name,
            valueKind: editedTaskType.valueKind,
            taskTypeEnumOptions: stripEnumOptions(
              editedTaskType.taskTypeEnumOptions!
            ),
            archivedTaskTypeEnumOptions: [],
          }
        : {
            name: editedTaskType.name,
            valueKind: editedTaskType.valueKind,
          };

  const form = useAppForm({
    defaultValues,
    validators: {
      onBlur: updateTaskTypeZodSchema,
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
    <Drawer
      title={m.taskTypes_edit_drawer_title()}
      description={m.taskTypes_edit_drawer_description()}
      customFooter
    >
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
                  <field.Select label={m.taskTypes_form_field_unitId_label()}>
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
          <Drawer.Footer>
            <form.SubmitButton />
          </Drawer.Footer>
        </form.FormRoot>
      </form.AppForm>
    </Drawer>
  );
}
