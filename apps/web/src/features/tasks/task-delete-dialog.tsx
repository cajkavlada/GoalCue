import { Id } from "@gc/convex/types";
import { m } from "@gc/i18n/messages";
import { Dialog } from "@gc/ui";
import { ExtendedTask } from "@gc/validators";

import { taskApi } from "./task.api";

type TaskDeleteDialogProps =
  | { task: ExtendedTask; taskIds?: never }
  | { taskIds: Id<"tasks">[]; task?: never };

export function TaskDeleteDialog(props: TaskDeleteDialogProps) {
  const archiveMutation = taskApi.useArchive();

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
