import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { Drawer, useModal } from "@gc/ui";
import { CreateUnitArgs, createUnitZodSchema } from "@gc/validators";

export function UnitCreateDrawer() {
  const { closeDrawer } = useModal();

  const createMutation = useMutation({
    mutationFn: useConvexMutation(api.units.create),
    onSuccess: () => {
      closeDrawer();
    },
  });

  const form = useAppForm({
    defaultValues: {
      name: "",
      symbol: "",
    } as CreateUnitArgs,
    validators: {
      onBlur: createUnitZodSchema,
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(value);
    },
  });

  return (
    <Drawer
      title={m.units_create_drawer_title()}
      description={m.units_create_drawer_description()}
      customFooter
    >
      <form.AppForm>
        <form.FormRoot className="flex flex-col gap-4">
          <form.AppField name="name">
            {(field) => (
              <field.Input
                label={m.units_form_field_name_label()}
                autoFocus
              />
            )}
          </form.AppField>
          <form.AppField name="symbol">
            {(field) => (
              <field.Input label={m.units_form_field_symbol_label()} />
            )}
          </form.AppField>
          <Drawer.Footer>
            <form.SubmitButton />
          </Drawer.Footer>
        </form.FormRoot>
      </form.AppForm>
    </Drawer>
  );
}
