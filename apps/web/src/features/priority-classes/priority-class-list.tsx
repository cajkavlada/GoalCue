import { useRef } from "react";
import { isSortable } from "@dnd-kit/dom/sortable";
import { DragDropProvider } from "@dnd-kit/react";
import { generateKeyBetween } from "fractional-indexing";
import { Trash2 } from "lucide-react";

import { m } from "@gc/i18n/messages";
import { useBulkSelect } from "@gc/react-kit";
import { ActionMenu, Checkbox, DropdownMenuItem, useModal } from "@gc/ui";
import { PriorityClass } from "@gc/validators";

import { getItemsAroundTarget } from "@/utils/algorithms/dnd-items-around-target";
import { PriorityClassDeleteDialog } from "./priority-class-delete-dialog";
import { PriorityClassListItem } from "./priority-class-list-item";
import { useUpdatePriorityClass } from "./use-priority-classes";

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
  const updateMutation = useUpdatePriorityClass();

  const droppableRef = useRef<HTMLDivElement>(null);

  function handleDragEnd(fromIndex: number, toIndex: number) {
    const movedPriorityClass = priorityClasses[fromIndex];
    if (!movedPriorityClass || fromIndex === toIndex) {
      return;
    }

    const { beforeItem, afterItem } = getItemsAroundTarget({
      items: priorityClasses,
      fromIndex,
      toIndex,
    });

    updateMutation.mutate({
      priorityClassId: movedPriorityClass._id,
      orderKey: generateKeyBetween(
        beforeItem?.orderKey ?? null,
        afterItem?.orderKey ?? null
      ),
    });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {priorityClasses.length === 0 && (
        <div className="text-center text-gray-500">{emptyMessage}</div>
      )}
      {priorityClasses.length > 0 && (
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
          <div
            className="flex-1 overflow-hidden"
            ref={droppableRef}
          >
            <DragDropProvider
              onDragEnd={(event) => {
                if (isSortable(event.operation.source)) {
                  const sortable = event.operation.source.sortable;
                  handleDragEnd(sortable.initialIndex, sortable.index);
                }
              }}
            >
              <ol className="h-full overflow-auto">
                {priorityClasses.map((priorityClass, index) => (
                  <PriorityClassListItem
                    key={priorityClass._id}
                    index={index}
                    priorityClass={priorityClass}
                    droppableRef={droppableRef}
                  />
                ))}
              </ol>
            </DragDropProvider>
          </div>
        </>
      )}
    </div>
  );
}
