import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { Drawer } from "@gc/ui";
import {
  getUpdatePriorityClassZodSchema,
  PriorityClass,
  UpdatePriorityClassArgs,
} from "@gc/validators";

import { priorityClassApi } from "./priority-class.api";

export function PriorityClassEditDrawer({
  editedPriorityClass,
}: {
  editedPriorityClass: PriorityClass;
}) {
  return (
    <Drawer
      title={m.priorityClasses_edit_drawer_title()}
      description={m.priorityClasses_edit_drawer_description()}
      customFooter
    >
      <ErrorSuspense>
        <PriorityClassEditForm editedPriorityClass={editedPriorityClass} />
      </ErrorSuspense>
    </Drawer>
  );
}

export function PriorityClassEditForm({
  editedPriorityClass,
}: {
  editedPriorityClass: PriorityClass;
}) {
  const { data: priorityClasses } = priorityClassApi.useList();
  const updateMutation = priorityClassApi.useUpdate({});

  const defaultValues: UpdatePriorityClassArgs = {
    name: editedPriorityClass.name,
  };

  const form = useAppForm({
    defaultValues,
    validators: {
      onBlur: getUpdatePriorityClassZodSchema({
        existingPriorityClasses: priorityClasses,
        currentPriorityClassId: editedPriorityClass._id,
      }),
    },
    onSubmit: async ({ value }) => {
      await updateMutation.mutateAsync({
        priorityClassId: editedPriorityClass._id,
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
              label={m.priorityClasses_form_field_name_label()}
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
