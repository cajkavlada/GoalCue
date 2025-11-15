import { Id } from "@gc/convex/types";
import { m } from "@gc/i18n/messages";
import { Dialog } from "@gc/ui";
import { Tag } from "@gc/validators";

import { tagApi } from "./tag.api";

type TagDialogProps =
  | { tag: Tag; tagIds?: never }
  | { tagIds: Id<"tags">[]; tag?: never };

export function TagDeleteDialog(props: TagDialogProps) {
  const archiveMutation = tagApi.useArchive();

  return (
    <Dialog
      title={m.tags_delete_dialog_title()}
      description={
        props.tag
          ? m.tags_delete_single_dialog_description({
              name: props.tag.name,
            })
          : m.tags_delete_multiple_dialog_description({
              count: props.tagIds?.length ?? 0,
            })
      }
      showDescription
      submitLabel={m.delete()}
      onSubmit={() =>
        archiveMutation.mutate({ tagIds: props.tagIds ?? [props.tag?._id] })
      }
      submitStatus={archiveMutation.status}
    />
  );
}
