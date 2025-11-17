import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { Drawer } from "@gc/ui";
import {
  getUpdateTagZodSchema,
  Tag,
  TAG_COLORS,
  UpdateTagArgs,
} from "@gc/validators";

import { tagApi } from "./tag.api";

export function TagEditDrawer({ editedTag }: { editedTag: Tag }) {
  return (
    <Drawer
      title={m.tags_edit_drawer_title()}
      description={m.tags_edit_drawer_description()}
      customFooter
    >
      <ErrorSuspense>
        <TagEditForm editedTag={editedTag} />
      </ErrorSuspense>
    </Drawer>
  );
}

export function TagEditForm({ editedTag }: { editedTag: Tag }) {
  const { data: tags } = tagApi.useList();
  const updateMutation = tagApi.useUpdate();

  const defaultValues: UpdateTagArgs = {
    name: editedTag.name,
    color: editedTag.color,
  };

  const form = useAppForm({
    defaultValues,
    validators: {
      onBlur: getUpdateTagZodSchema({
        existingTags: tags,
        currentTagId: editedTag._id,
      }),
    },
    onSubmit: async ({ value }) => {
      await updateMutation.mutateAsync({
        tagId: editedTag._id,
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
