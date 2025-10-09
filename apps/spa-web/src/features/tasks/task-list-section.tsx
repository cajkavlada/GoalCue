import { EllipsisVerticalIcon } from "lucide-react";

import { m } from "@gc/i18n/messages";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useDialog,
} from "@gc/ui";
import { ExtendedTask } from "@gc/validators";

import { BoolTaskActionCheckbox } from "../task-actions/bool-task-action-checkbox";
import { EnumTaskActionSelect } from "../task-actions/enum-task-action-select";
import { NumberTaskActionInput } from "../task-actions/number-task-action-input";
import { TaskDeleteDialog } from "./task-delete-dialog";

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
    <div>
      {tasks.map((task) => (
        <div
          key={task._id}
          className="flex items-center gap-2"
        >
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
              >
                <EllipsisVerticalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem disabled>{m.edit()}</DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => openDialog(<TaskDeleteDialog task={task} />)}
              >
                {m.delete()}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
      {tasks.length === 0 && emptyMessage && (
        <div className="text-center text-gray-500">{emptyMessage}</div>
      )}
    </div>
  );
}
