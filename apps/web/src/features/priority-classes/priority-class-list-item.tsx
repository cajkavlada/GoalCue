import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { RestrictToElement } from "@dnd-kit/dom/modifiers";
import { useSortable } from "@dnd-kit/react/sortable";
import { GripVertical, Pencil, Trash2 } from "lucide-react";

import { m } from "@gc/i18n/messages";
import { useItemSelect } from "@gc/react-kit";
import {
  ActionMenu,
  DropdownMenuItem,
  TruncateWithTooltip,
  useModal,
} from "@gc/ui";
import { cn } from "@gc/utils";
import { PriorityClass } from "@gc/validators";

import { PriorityClassDeleteDialog } from "./priority-class-delete-dialog";
import { PriorityClassEditDrawer } from "./priority-class-edit-drawer";

export function PriorityClassListItem({
  priorityClass,
  index,
  droppableRef,
}: {
  priorityClass: PriorityClass;
  index: number;
  droppableRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { openDialog, openDrawer } = useModal();
  const { isItemSelected, toggleSelectItem } = useItemSelect(priorityClass);

  const { ref, handleRef } = useSortable({
    id: priorityClass._id,
    index,
    transition: { idle: true },
    modifiers: [
      RestrictToVerticalAxis,
      RestrictToElement.configure({ element: droppableRef.current }),
    ],
  });
  return (
    <li ref={ref}>
      <div
        className={cn(
          "flex select-none items-center gap-2 pr-2",
          isItemSelected && "bg-accent text-accent-foreground"
        )}
        onClick={toggleSelectItem}
      >
        <div
          ref={handleRef}
          className="cursor-grab"
        >
          <GripVertical />
        </div>
        <TruncateWithTooltip
          text={priorityClass.name}
          className="mr-auto"
        />
        <div onClick={(e) => e.stopPropagation()}>
          <ActionMenu>
            <DropdownMenuItem
              onClick={() =>
                openDrawer(
                  <PriorityClassEditDrawer
                    editedPriorityClass={priorityClass}
                  />
                )
              }
            >
              <Pencil />
              {m.edit()}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                openDialog(
                  <PriorityClassDeleteDialog priorityClass={priorityClass} />
                )
              }
            >
              <Trash2 className="text-red-700" />
              {m.delete()}
            </DropdownMenuItem>
          </ActionMenu>
        </div>
      </div>
    </li>
  );
}
