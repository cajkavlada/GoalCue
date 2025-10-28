import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { Drawer } from "@gc/ui";
import { Unit, UpdateUnitArgs, updateUnitZodSchema } from "@gc/validators";

import { useUpdateUnit } from "./use-units";

export function UnitEditDrawer({ editedUnit }: { editedUnit: Unit }) {
  return (
    <Drawer
      title={m.units_edit_drawer_title()}
      description={m.units_edit_drawer_description()}
      customFooter
    >
      <ErrorSuspense>
        <UnitEditForm editedUnit={editedUnit} />
      </ErrorSuspense>
    </Drawer>
  );
}

export function UnitEditForm({ editedUnit }: { editedUnit: Unit }) {
  const updateMutation = useUpdateUnit();

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
          {(field) => <field.Input label={m.units_form_field_symbol_label()} />}
        </form.AppField>
        <Drawer.Footer>
          <form.SubmitButton />
        </Drawer.Footer>
      </form.FormRoot>
    </form.AppForm>
  );
}
