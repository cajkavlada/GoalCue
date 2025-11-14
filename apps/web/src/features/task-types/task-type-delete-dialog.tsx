import { Id } from "@gc/convex/types";
import { m } from "@gc/i18n/messages";
import { Dialog } from "@gc/ui";
import { TaskType } from "@gc/validators";

import { taskTypeApi } from "./task-type.api";

type TaskTypeDeleteDialogProps =
  | { taskType: TaskType; taskTypeIds?: never }
  | { taskTypeIds: Id<"taskTypes">[]; taskType?: never };

export function TaskTypeDeleteDialog(props: TaskTypeDeleteDialogProps) {
  const archiveMutation = taskTypeApi.useArchive();

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
