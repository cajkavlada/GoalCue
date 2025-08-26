import { ExtendedTask } from "@gc/validators";

import { BoolTaskActionCheckbox } from "../task-actions/bool-task-action-checkbox";
import { EnumTaskActionSelect } from "../task-actions/enum-task-action-select";
import { NumberTaskActionInput } from "../task-actions/number-task-action-input";

export function TasksSection({
  tasks,
  completedAfter,
  emptyMessage,
}: {
  tasks: ExtendedTask[];
  completedAfter?: number;
  emptyMessage?: string;
}) {
  return (
    <div>
      {tasks.map((task) => (
        <div
          key={task._id}
          className="flex items-center gap-2"
        >
          {task.title}
          {task.completed ? "Done" : "Not done"}
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
        </div>
      ))}
      {tasks.length === 0 && emptyMessage && (
        <div className="text-center text-gray-500">{emptyMessage}</div>
      )}
    </div>
  );
}
