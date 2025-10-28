import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import { CircleQuestionMark } from "lucide-react";

import { api } from "@gc/convex/api";
import { Id } from "@gc/convex/types";
import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { Drawer, SelectItem, Tooltip, useModal } from "@gc/ui";
import { CreateTaskTypeArgs, createTaskTypeZodSchema } from "@gc/validators";

import { TaskTypeEnumOptionsEditor } from "../task-type-enum-options/task-type-enum-options-editor";
import { useUnits } from "../units/use-units";

export function TaskTypeCreateDrawer() {
  const { closeDrawer } = useModal();

  const { data: units } = useUnits();

  const createMutation = useMutation({
    mutationFn: useConvexMutation(api.taskTypes.create),
    onSuccess: () => {
      closeDrawer();
    },
  });

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

  return (
    <Drawer
      title={m.taskTypes_create_drawer_title()}
      description={m.taskTypes_create_drawer_description()}
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
          <form.AppField name="valueKind">
            {(field) => (
              <field.Select
                label={m.taskTypes_form_field_valueKind_label()}
                onValueChange={(valueKind) => {
                  if (valueKind === "number") {
                    form.setFieldValue("initialNumValue", 0);
                    form.setFieldValue("completedNumValue", 10);
                    form.setFieldValue("unitId", "none" as Id<"units">); // default to none
                  } else {
                    form.deleteField("initialNumValue");
                    form.deleteField("completedNumValue");
                  }
                  if (valueKind === "enum") {
                    form.setFieldValue("taskTypeEnumOptions", []);
                  } else {
                    form.deleteField("taskTypeEnumOptions");
                  }
                }}
              >
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
                        <field.Select
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
    </Drawer>
  );
}
