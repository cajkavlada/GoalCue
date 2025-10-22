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
import { ExtendedTask } from "@gc/validators";

import { BoolTaskActionCheckbox } from "../task-actions/bool-task-action-checkbox";
import { EnumTaskActionSelect } from "../task-actions/enum-task-action-select";
import { NumberTaskActionInput } from "../task-actions/number-task-action-input";
import { TaskDeleteDialog } from "./task-delete-dialog";
import { TaskEditDrawer } from "./task-edit-drawer";

export function TaskListItem({
  task,
  completedAfter,
}: {
  task: ExtendedTask;
  completedAfter?: number;
}) {
  const { openDialog, openDrawer } = useModal();
  const { isItemSelected, toggleSelectItem } = useItemSelect(task);

  return (
    <div
      className={cn(
        "flex select-none items-center gap-2 px-2",
        isItemSelected && "bg-accent text-accent-foreground"
      )}
      onClick={toggleSelectItem}
    >
      <TruncateWithTooltip
        text={task.title}
        className="mr-auto"
      />
      <div
        className="flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {task.valueKind === "boolean" && (
          <BoolTaskActionCheckbox
            task={task}
            completedAfter={completedAfter}
          />
        )}
        {task.valueKind === "number" && (
          <NumberTaskActionInput
            task={task}
            completedAfter={completedAfter}
          />
        )}
        {task.valueKind === "enum" && (
          <EnumTaskActionSelect
            task={task}
            completedAfter={completedAfter}
          />
        )}

        <ActionMenu>
          <DropdownMenuItem
            onClick={() => openDrawer(<TaskEditDrawer editedTask={task} />)}
          >
            <Pencil />
            {m.edit()}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openDialog(<TaskDeleteDialog task={task} />)}
          >
            <Trash2 className="text-red-700" />
            {m.delete()}
          </DropdownMenuItem>
        </ActionMenu>
      </div>
    </div>
  );
}
