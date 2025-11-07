import { Trash2 } from "lucide-react";

import { m } from "@gc/i18n/messages";
import { useBulkSelect, VirtualList } from "@gc/react-kit";
import { ActionMenu, Checkbox, DropdownMenuItem, useModal } from "@gc/ui";
import { PriorityClass } from "@gc/validators";

import { PriorityClassDeleteDialog } from "./priority-class-delete-dialog";
import { PriorityClassListItem } from "./priority-class-list-item";

export function PriorityClassList({
  priorityClasses,
  emptyMessage,
}: {
  priorityClasses: PriorityClass[];
  emptyMessage: string;
}) {
  const { openDialog } = useModal();
  const { isAllSelected, toggleSelectAll, selectedIds } =
    useBulkSelect<PriorityClass>();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {priorityClasses.length === 0 && (
        <div className="text-center text-gray-500">{emptyMessage}</div>
      )}
      {priorityClasses.length > 0 && (
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
                        <PriorityClassDeleteDialog
                          priorityClassIds={Array.from(selectedIds)}
                        />
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
              items={priorityClasses}
              estimateSize={() => 36}
              renderItem={(priorityClass) => (
                <PriorityClassListItem priorityClass={priorityClass} />
              )}
            />
          </div>
        </>
      )}
    </div>
  );
}
