import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { Drawer, useModal } from "@gc/ui";
import { Unit, UpdateUnitArgs, updateUnitZodSchema } from "@gc/validators";

export function UnitEditDrawer({ editedUnit }: { editedUnit: Unit }) {
  const { closeDrawer } = useModal();

  const updateMutation = useMutation({
    mutationFn: useConvexMutation(api.units.update),
    onSuccess: () => {
      closeDrawer();
    },
  });

  const defaultValues: UpdateUnitArgs = {
    name: editedUnit.name,
    symbol: editedUnit.symbol,
  };

  const form = useAppForm({
    defaultValues,
    validators: {
      onBlur: updateUnitZodSchema,
    },
    onSubmit: async ({ value }) => {
      await updateMutation.mutateAsync({
        unitId: editedUnit._id,
        ...value,
      });
    },
  });

  return (
    <Drawer
      title={m.units_edit_drawer_title()}
      description={m.units_edit_drawer_description()}
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
