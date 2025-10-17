import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { Drawer, useModal } from "@gc/ui";
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
        <Drawer.Footer>
          <form.SubmitButton />
        </Drawer.Footer>
      </form.FormRoot>
    </form.AppForm>
  );
}
