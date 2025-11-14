import { Id } from "@gc/convex/types";
import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { Drawer } from "@gc/ui";
import { CreateUnitArgs, getCreateUnitZodSchema } from "@gc/validators";

import { unitApi } from "./unit.api";

type UnitCreateFormProps = {
  onCreate?: (newUnitId: Id<"units">) => void;
};

export function UnitCreateDrawer(props: UnitCreateFormProps) {
  return (
    <Drawer
      title={m.units_create_drawer_title()}
      description={m.units_create_drawer_description()}
      customFooter
    >
      <ErrorSuspense>
        <UnitCreateForm {...props} />
      </ErrorSuspense>
    </Drawer>
  );
}

export function UnitCreateForm({ onCreate }: UnitCreateFormProps) {
  const { data: units } = unitApi.useList();
  const createMutation = unitApi.useCreate(onCreate);

  const form = useAppForm({
    defaultValues: {
      name: "",
      symbol: "",
    } as CreateUnitArgs,
    validators: {
      onBlur: getCreateUnitZodSchema({ existingUnits: units }),
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
