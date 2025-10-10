import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { m } from "@gc/i18n/messages";
import { Dialog, useDialog } from "@gc/ui";
import { ExtendedTask } from "@gc/validators";

export function TaskDeleteDialog({ task }: { task: ExtendedTask }) {
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
      description={m.tasks_delete_dialog_description({ title: task.title })}
      showDescription
      submitLabel={m.delete()}
      onSubmit={() => archiveMutation.mutate({ taskId: task._id })}
      submitStatus={archiveMutation.status}
    />
  );
}
