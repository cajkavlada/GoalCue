import { Trash2 } from "lucide-react";

import { m } from "@gc/i18n/messages";
import { useBulkSelect, VirtualList } from "@gc/react-kit";
import { ActionMenu, Checkbox, DropdownMenuItem, useModal } from "@gc/ui";
import { ExtendedTaskType } from "@gc/validators";

import { TaskTypeDeleteDialog } from "./task-type-delete-dialog";
import { TaskTypeListItem } from "./task-type-list-item";

export function TaskTypeList({
  taskTypes,
  emptyMessage,
}: {
  taskTypes: ExtendedTaskType[];
  emptyMessage: string;
}) {
  const { openDialog } = useModal();
  const { isAllSelected, toggleSelectAll, selectedIds } =
    useBulkSelect<ExtendedTaskType>();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {taskTypes.length === 0 && (
        <div className="text-center text-gray-500">{emptyMessage}</div>
      )}
      {taskTypes.length > 0 && (
        <>
          <div className="flex h-[36px] items-center gap-2 pl-1 pr-2">
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
                        <TaskTypeDeleteDialog
                          taskTypeIds={Array.from(selectedIds)}
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
              items={taskTypes}
              estimateSize={() => 36}
              renderItem={(taskType) => (
                <TaskTypeListItem taskType={taskType} />
              )}
            />
          </div>
        </>
      )}
    </div>
  );
}
