import { Id } from "@gc/convex/types";
import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { Drawer } from "@gc/ui";
import {
  CreateTagArgs,
  getCreateTagZodSchema,
  TAG_COLORS,
} from "@gc/validators";

import { tagApi } from "./tag.api";

type TagCreateFormProps = {
  onCreate?: (newTagId: Id<"tags">) => void;
};

export function TagCreateDrawer(props: TagCreateFormProps) {
  return (
    <Drawer
      title={m.tags_create_drawer_title()}
      description={m.tags_create_drawer_description()}
      customFooter
    >
      <ErrorSuspense>
        <TagCreateForm {...props} />
      </ErrorSuspense>
    </Drawer>
  );
}

export function TagCreateForm({ onCreate }: TagCreateFormProps) {
  const { data: tags } = tagApi.useList();
  const createMutation = tagApi.useCreate(onCreate);

  const form = useAppForm({
    defaultValues: {
      name: "",
    } as CreateTagArgs,
    validators: {
      onBlur: getCreateTagZodSchema({ existingTags: tags }),
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
              label={m.tags_form_field_name_label()}
              autoFocus
            />
          )}
        </form.AppField>
        <form.AppField name="color">
          {(field) => (
            <field.ColorPicker
              label={m.tags_form_field_color_label()}
              colors={TAG_COLORS}
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
