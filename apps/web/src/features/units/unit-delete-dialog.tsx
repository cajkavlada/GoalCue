import { Id } from "@gc/convex/types";
import { m } from "@gc/i18n/messages";
import { Dialog } from "@gc/ui";
import { Unit } from "@gc/validators";

import { unitApi } from "./unit.api";

type UnitDialogProps =
  | { unit: Unit; unitIds?: never }
  | { unitIds: Id<"units">[]; unit?: never };

export function UnitDeleteDialog(props: UnitDialogProps) {
  const archiveMutation = unitApi.useArchive();

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
