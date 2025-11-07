import { Pencil, Trash2 } from "lucide-react";

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

export function PriorityClassListItem({
  priorityClass,
}: {
  priorityClass: PriorityClass;
}) {
  const { openDialog } = useModal();
  const { isItemSelected, toggleSelectItem } = useItemSelect(priorityClass);
  return (
    <div
      className={cn(
        "flex select-none items-center gap-2 px-2",
        isItemSelected && "bg-accent text-accent-foreground"
      )}
      onClick={toggleSelectItem}
    >
      <TruncateWithTooltip
        text={priorityClass.name}
        className="mr-auto"
      />
      <div onClick={(e) => e.stopPropagation()}>
        <ActionMenu>
          <DropdownMenuItem
            disabled
            // onClick={() => openDrawer(<UnitEditDrawer editedUnit={unit} />)}
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
  );
}
