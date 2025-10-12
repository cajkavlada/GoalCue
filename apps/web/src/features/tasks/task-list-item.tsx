import { m } from "@gc/i18n/messages";
import { useItemSelect } from "@gc/react-kit";
import { ActionMenu, Checkbox, DropdownMenuItem, useDialog } from "@gc/ui";
import { ExtendedTask } from "@gc/validators";

import { BoolTaskActionCheckbox } from "../task-actions/bool-task-action-checkbox";
import { EnumTaskActionSelect } from "../task-actions/enum-task-action-select";
import { NumberTaskActionInput } from "../task-actions/number-task-action-input";
import { TaskDeleteDialog } from "./task-delete-dialog";
import { TaskEditDialog } from "./task-edit-dialog";

export function TaskListItem({
  task,
  completedAfter,
}: {
  task: ExtendedTask;
  completedAfter?: number;
}) {
  const { openDialog } = useDialog();
  const { isItemSelected, toggleSelectItem } = useItemSelect(task);

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={isItemSelected}
        onCheckedChange={toggleSelectItem}
      />
      {task.title}
      {task.completedAt ? "Done" : "Not done"}
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
          onClick={() => openDialog(<TaskEditDialog editedTask={task} />)}
        >
          {m.edit()}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => openDialog(<TaskDeleteDialog task={task} />)}
        >
          {m.delete()}
        </DropdownMenuItem>
      </ActionMenu>
    </div>
  );
}
