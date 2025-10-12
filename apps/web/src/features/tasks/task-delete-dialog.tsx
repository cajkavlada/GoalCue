import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { Id } from "@gc/convex/types";
import { m } from "@gc/i18n/messages";
import { Dialog, useDialog } from "@gc/ui";
import { ExtendedTask } from "@gc/validators";

type TaskDeleteDialogProps =
  | { task: ExtendedTask; taskIds?: never }
  | { taskIds: Id<"tasks">[]; task?: never };

export function TaskDeleteDialog(props: TaskDeleteDialogProps) {
  const { closeDialog } = useDialog();

  const archiveMutation = useMutation({
    mutationFn: useConvexMutation(api.tasks.archive),
    onSuccess: () => {
      closeDialog();
    },
  });

  return (
    <Dialog
      title={m.tasks_delete_dialog_title()}
      description={
        props.task
          ? m.tasks_delete_single_dialog_description({
              title: props.task.title,
            })
          : m.tasks_delete_multiple_dialog_description({
              count: props.taskIds?.length ?? 0,
            })
      }
      showDescription
      submitLabel={m.delete()}
      onSubmit={() =>
        archiveMutation.mutate({ taskIds: props.taskIds ?? [props.task?._id] })
      }
      submitStatus={archiveMutation.status}
    />
  );
}
