import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import { CircleQuestionMark } from "lucide-react";

import { api } from "@gc/convex/api";
import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { Drawer, SelectItem, Tooltip, useModal } from "@gc/ui";
import { CreateTaskTypeArgs, createTaskTypeZodSchema } from "@gc/validators";

export function TaskTypeCreateDrawer() {
  return (
    <Drawer
      title={m.taskTypes_create_drawer_title()}
      description={m.taskTypes_create_drawer_description()}
      customFooter
    >
      <ErrorSuspense>
        <TaskTypeCreateForm />
      </ErrorSuspense>
    </Drawer>
  );
}

function TaskTypeCreateForm() {
  const { closeDrawer } = useModal();

  const createMutation = useMutation({
    mutationFn: useConvexMutation(api.taskTypes.create),
    onSuccess: () => {
      closeDrawer();
    },
  });

  const defaultValues: CreateTaskTypeArgs = {
    name: "",
    valueKind: "boolean",
    initialNumValue: undefined,
    completedNumValue: undefined,
  };

  const form = useAppForm({
    defaultValues,
    validators: {
      onBlur: createTaskTypeZodSchema,
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(value);
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
        <form.AppField name="valueKind">
          {(field) => (
            <field.Select
              label={m.taskTypes_form_field_valueKind_label()}
              onValueChange={(valueKind) => {
                form.setFieldValue(
                  "initialNumValue",
                  valueKind === "number" ? 0 : undefined
                );
                form.setFieldValue(
                  "completedNumValue",
                  valueKind === "number" ? 10 : undefined
                );
              }}
            >
              <SelectItem value="boolean">
                {m.taskTypes_form_field_valueKind_boolean()}
                <Tooltip
                  content={m.taskTypes_form_field_valueKind_boolean_description()}
                >
                  <CircleQuestionMark />
                </Tooltip>
              </SelectItem>
              <SelectItem value="number">
                {m.taskTypes_form_field_valueKind_number()}
                <Tooltip
                  content={m.taskTypes_form_field_valueKind_number_description()}
                >
                  <CircleQuestionMark />
                </Tooltip>
              </SelectItem>
              {/* <SelectItem value="enum">
                {m.taskTypes_form_field_valueKind_enum()}
                <Tooltip
                  content={m.taskTypes_form_field_valueKind_enum_description()}
                >
                  <CircleQuestionMark />
                </Tooltip>
              </SelectItem> */}
            </field.Select>
          )}
        </form.AppField>
        <form.Subscribe selector={(state) => state.values.valueKind}>
          {(valueKind) =>
            valueKind === "number" && (
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
            )
          }
        </form.Subscribe>
        <Drawer.Footer>
          <form.SubmitButton />
        </Drawer.Footer>
      </form.FormRoot>
    </form.AppForm>
  );
}
