import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { Id } from "@gc/convex/types";
import { m } from "@gc/i18n/messages";
import { Dialog, useModal } from "@gc/ui";
import { Unit } from "@gc/validators";

type UnitDialogProps =
  | { unit: Unit; unitIds?: never }
  | { unitIds: Id<"units">[]; unit?: never };

export function UnitDeleteDialog(props: UnitDialogProps) {
  const { closeDialog } = useModal();

  const archiveMutation = useMutation({
    mutationFn: useConvexMutation(api.units.archive),
    onSuccess: () => {
      closeDialog();
    },
  });

  return (
    <Dialog
      title={m.units_delete_dialog_title()}
      description={
        props.unit
          ? m.units_delete_single_dialog_description({
              name: props.unit.name,
            })
          : m.units_delete_multiple_dialog_description({
              count: props.unitIds?.length ?? 0,
            })
      }
      showDescription
      submitLabel={m.delete()}
      onSubmit={() =>
        archiveMutation.mutate({ unitIds: props.unitIds ?? [props.unit?._id] })
      }
      submitStatus={archiveMutation.status}
    />
  );
}
