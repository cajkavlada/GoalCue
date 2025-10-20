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
import { TaskType } from "@gc/validators";

import { TaskTypeDeleteDialog } from "./task-type-delete-dialog";

export function TaskTypeListItem({ taskType }: { taskType: TaskType }) {
  const { openDialog } = useModal();
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
      <ActionMenu>
        <DropdownMenuItem disabled>
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
  );
}
