import { Id } from "@gc/convex/types";
import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { Drawer } from "@gc/ui";
import {
  CreatePriorityClassArgs,
  getCreatePriorityClassZodSchema,
} from "@gc/validators";

import {
  useCreatePriorityClass,
  usePriorityClasses,
} from "./use-priority-classes";

type PriorityClassCreateFormProps = {
  onCreate?: (newPriorityClassId: Id<"priorityClasses">) => void;
};

export function PriorityClassCreateDrawer(props: PriorityClassCreateFormProps) {
  return (
    <Drawer
      title={m.priorityClasses_create_drawer_title()}
      description={m.priorityClasses_create_drawer_description()}
      customFooter
    >
      <ErrorSuspense>
        <PriorityClassCreateForm {...props} />
      </ErrorSuspense>
    </Drawer>
  );
}

export function PriorityClassCreateForm({
  onCreate,
}: PriorityClassCreateFormProps) {
  const createMutation = useCreatePriorityClass(onCreate);
  const { data: priorityClasses } = usePriorityClasses();

  const form = useAppForm({
    defaultValues: {
      name: "",
    } satisfies CreatePriorityClassArgs,
    validators: {
      onBlur: getCreatePriorityClassZodSchema({
        existingPriorityClasses: priorityClasses,
      }),
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
