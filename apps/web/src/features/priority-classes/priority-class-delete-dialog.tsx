import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { Id } from "@gc/convex/types";
import { m } from "@gc/i18n/messages";
import { Dialog, useModal } from "@gc/ui";
import { PriorityClass } from "@gc/validators";

type PriorityClassDialogProps =
  | { priorityClass: PriorityClass; priorityClassIds?: never }
  | { priorityClassIds: Id<"priorityClasses">[]; priorityClass?: never };

export function PriorityClassDeleteDialog(props: PriorityClassDialogProps) {
  const { closeDialog } = useModal();

  const archiveMutation = useMutation({
    mutationFn: useConvexMutation(api.priorityClasses.archive),
    onSuccess: () => {
      closeDialog();
    },
  });

  return (
    <Dialog
      title={m.priorityClasses_delete_dialog_title()}
      description={
        props.priorityClass
          ? m.priorityClasses_delete_single_dialog_description({
              name: props.priorityClass.name,
            })
          : m.priorityClasses_delete_multiple_dialog_description({
              count: props.priorityClassIds?.length ?? 0,
            })
      }
      showDescription
      submitLabel={m.delete()}
      onSubmit={() =>
        archiveMutation.mutate({
          priorityClassIds: props.priorityClassIds ?? [
            props.priorityClass?._id,
          ],
        })
      }
      submitStatus={archiveMutation.status}
    />
  );
}
