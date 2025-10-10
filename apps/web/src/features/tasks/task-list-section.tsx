import { m } from "@gc/i18n/messages";
import { VirtualList } from "@gc/react-kit";
import { DropdownMenuItem, ListItemMenu, useDialog } from "@gc/ui";
import { ExtendedTask } from "@gc/validators";

import { BoolTaskActionCheckbox } from "../task-actions/bool-task-action-checkbox";
import { EnumTaskActionSelect } from "../task-actions/enum-task-action-select";
import { NumberTaskActionInput } from "../task-actions/number-task-action-input";
import { TaskDeleteDialog } from "./task-delete-dialog";
import { TaskEditDialog } from "./task-edit-dialog";

export function TaskListSection({
  tasks,
  completedAfter,
  emptyMessage,
}: {
  tasks: ExtendedTask[];
  completedAfter?: number;
  emptyMessage?: string;
}) {
  const { openDialog } = useDialog();
  return (
    <div className="flex-1 overflow-hidden">
      {tasks.length > 0 && (
        <VirtualList
          className="h-full"
          items={tasks}
          estimateSize={() => 30}
          renderItem={(task) => (
            <div className="flex items-center gap-2">
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
              <ListItemMenu>
                <DropdownMenuItem
                  onClick={() =>
                    openDialog(<TaskEditDialog editedTask={task} />)
                  }
                >
                  {m.edit()}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => openDialog(<TaskDeleteDialog task={task} />)}
                >
                  {m.delete()}
                </DropdownMenuItem>
              </ListItemMenu>
            </div>
          )}
        />
      )}
      {tasks.length === 0 && emptyMessage && (
        <div className="text-center text-gray-500">{emptyMessage}</div>
      )}
    </div>
  );
}
