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
import { ExtendedTaskType } from "@gc/validators";

import { TaskTypeDeleteDialog } from "./task-type-delete-dialog";
import { TaskTypeEditDrawer } from "./task-type-edit-drawer";

export function TaskTypeListItem({ taskType }: { taskType: ExtendedTaskType }) {
  const { openDialog, openDrawer } = useModal();
  const { isItemSelected, toggleSelectItem } = useItemSelect(taskType);
  return (
    <div
      className={cn(
        "flex select-none items-center gap-2 px-2",
        isItemSelected && "bg-accent text-accent-foreground"
      )}
      onClick={toggleSelectItem}
    >
      <TruncateWithTooltip
        text={taskType.name}
        className="mr-auto"
      />
      <div onClick={(e) => e.stopPropagation()}>
        <ActionMenu>
          <DropdownMenuItem
            onClick={() =>
              openDrawer(<TaskTypeEditDrawer editedTaskType={taskType} />)
            }
          >
            <Pencil />
            {m.edit()}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              openDialog(<TaskTypeDeleteDialog taskType={taskType} />)
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
