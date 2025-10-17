import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { Id } from "@gc/convex/types";
import { m } from "@gc/i18n/messages";
import { Dialog, useModal } from "@gc/ui";
import { TaskType } from "@gc/validators";

type TaskTypeDeleteDialogProps =
  | { taskType: TaskType; taskTypeIds?: never }
  | { taskTypeIds: Id<"taskTypes">[]; taskType?: never };

export function TaskTypeDeleteDialog(props: TaskTypeDeleteDialogProps) {
  const { closeDialog } = useModal();

  const archiveMutation = useMutation({
    mutationFn: useConvexMutation(api.taskTypes.archive),
    onSuccess: () => {
      closeDialog();
    },
  });

  return (
    <Dialog
      title={m.tasks_delete_dialog_title()}
      description={
        props.taskType
          ? m.taskTypes_delete_single_dialog_description({
              name: props.taskType.name,
            })
          : m.taskTypes_delete_multiple_dialog_description({
              count: props.taskTypeIds?.length ?? 0,
            })
      }
      showDescription
      submitLabel={m.delete()}
      onSubmit={() =>
        archiveMutation.mutate({
          taskTypeIds: props.taskTypeIds ?? [props.taskType?._id],
        })
      }
      submitStatus={archiveMutation.status}
    />
  );
}
