import { Trash2 } from "lucide-react";

import { m } from "@gc/i18n/messages";
import { useBulkSelect, VirtualList } from "@gc/react-kit";
import { ActionMenu, Checkbox, DropdownMenuItem, useModal } from "@gc/ui";
import { Unit } from "@gc/validators";

import { UnitDeleteDialog } from "./unit-delete-dialog";
import { UnitListItem } from "./unit-list-item";

export function UnitList({
  units,
  emptyMessage,
}: {
  units: Unit[];
  emptyMessage: string;
}) {
  const { openDialog } = useModal();
  const { isAllSelected, toggleSelectAll, selectedIds } = useBulkSelect<Unit>();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {units.length === 0 && (
        <div className="text-center text-gray-500">{emptyMessage}</div>
      )}
      {units.length > 0 && (
        <>
          <div className="flex h-[36px] items-center gap-2 pr-2">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={toggleSelectAll}
            />
            {selectedIds.size > 0 && (
              <>
                <p className="min-w-[20px]">{selectedIds.size}</p>
                <ActionMenu>
                  <DropdownMenuItem
                    onClick={() =>
                      openDialog(
                        <UnitDeleteDialog unitIds={Array.from(selectedIds)} />
                      )
                    }
                  >
                    <Trash2 className="text-red-700" />
                    {m.delete()}
                  </DropdownMenuItem>
                </ActionMenu>
              </>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <VirtualList
              className="h-full"
              items={units}
              estimateSize={() => 36}
              renderItem={(unit) => <UnitListItem unit={unit} />}
            />
          </div>
        </>
      )}
    </div>
  );
}
