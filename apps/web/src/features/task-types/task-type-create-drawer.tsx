import { CircleQuestionMark, Plus } from "lucide-react";

import { Id } from "@gc/convex/types";
import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { Drawer, DrawerButton, SelectItem, Tooltip } from "@gc/ui";
import { CreateTaskTypeArgs, createTaskTypeZodSchema } from "@gc/validators";

import { TaskTypeEnumOptionsEditor } from "../task-type-enum-options/task-type-enum-options-editor";
import { UnitCreateDrawer } from "../units/unit-create-drawer";
import { useUnits } from "../units/use-units";
import { useCreateTaskType } from "./use-task-types";

type TaskTypeCreateFormProps = {
  onCreate?: (newTaskTypeId: Id<"taskTypes">) => void;
};

export function TaskTypeCreateDrawer(props: TaskTypeCreateFormProps) {
  return (
    <Drawer
      title={m.taskTypes_create_drawer_title()}
      description={m.taskTypes_create_drawer_description()}
      customFooter
    >
      <ErrorSuspense>
        <TaskTypeCreateForm {...props} />
      </ErrorSuspense>
    </Drawer>
  );
}

function TaskTypeCreateForm({ onCreate }: TaskTypeCreateFormProps) {
  const { data: units } = useUnits();

  const createMutation = useCreateTaskType(onCreate);

  const form = useAppForm({
    defaultValues: {
      name: "",
      valueKind: "boolean",
    } as CreateTaskTypeArgs,
    validators: {
      onBlur: createTaskTypeZodSchema,
    },
    onSubmit: async ({ value }) => {
      // strip dndId from enum options
      if (value.valueKind === "enum") {
        value.taskTypeEnumOptions = value.taskTypeEnumOptions.map((option) => ({
          name: option.name,
        }));
      }
      if (value.valueKind === "number" && value.unitId === "none") {
        value.unitId = undefined;
      }
      await createMutation.mutateAsync(value);
    },
  });

  function onValueKindChange({
    value,
  }: {
    value: CreateTaskTypeArgs["valueKind"];
  }) {
    if (value === "number") {
      form.setFieldValue("initialNumValue", 0);
      form.setFieldValue("completedNumValue", 10);
      form.setFieldValue("unitId", "none" as Id<"units">); // default to none
    } else {
      form.deleteField("initialNumValue");
      form.deleteField("completedNumValue");
    }
    if (value === "enum") {
      form.setFieldValue("taskTypeEnumOptions", []);
    } else {
      form.deleteField("taskTypeEnumOptions");
    }
  }

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
        <form.AppField
          name="valueKind"
          listeners={{ onChange: onValueKindChange }}
        >
          {(field) => (
            <field.Select label={m.taskTypes_form_field_valueKind_label()}>
              <SelectItem value="boolean">
                {m.taskTypes_form_field_valueKind_boolean()}
                <Tooltip
                  content={m.taskTypes_form_field_valueKind_boolean_description()}
                >
                  <span>
                    <CircleQuestionMark />
                  </span>
                </Tooltip>
              </SelectItem>
              <SelectItem value="number">
                {m.taskTypes_form_field_valueKind_number()}
                <Tooltip
                  content={m.taskTypes_form_field_valueKind_number_description()}
                >
                  <span>
                    <CircleQuestionMark />
                  </span>
                </Tooltip>
              </SelectItem>
              <SelectItem value="enum">
                {m.taskTypes_form_field_valueKind_enum()}
                <Tooltip
                  content={m.taskTypes_form_field_valueKind_enum_description()}
                >
                  <span>
                    <CircleQuestionMark />
                  </span>
                </Tooltip>
              </SelectItem>
            </field.Select>
          )}
        </form.AppField>
        <form.Subscribe selector={(state) => state.values.valueKind}>
          {(valueKind) => {
            if (valueKind === "number") {
              return (
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
                              onCreate={(newUnitId) => {
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
              );
            }
            if (valueKind === "enum") {
              return (
                <form.AppField name="taskTypeEnumOptions">
                  {(field) => (
                    <TaskTypeEnumOptionsEditor
                      onAddEnumOption={(option) => {
                        field.pushValue(option);
                      }}
                      onRemoveEnumOption={(index) => {
                        field.removeValue(index);
                      }}
                      onEditEnumOption={(index, option) => {
                        field.replaceValue(index, {
                          ...field.state.value[index],
                          name: option,
                        });
                      }}
                    />
                  )}
                </form.AppField>
              );
            }
            return null;
          }}
        </form.Subscribe>
        <Drawer.Footer>
          <form.SubmitButton />
        </Drawer.Footer>
      </form.FormRoot>
    </form.AppForm>
  );
}
