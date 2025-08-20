import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";

import { api } from "@gc/convex/api";

import { BoolTaskActionCheckbox } from "../task-actions/bool-task-action-checkbox";
import { EnumTaskActionSelect } from "../task-actions/enum-task-action-select";
import { NumberTaskActionInput } from "../task-actions/number-task-action-input";

export function TaskList() {
  const { data: tasks } = useSuspenseQuery(
    convexQuery(api.tasks.getAllExtendedForUserId, {})
  );

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
            <BoolTaskActionCheckbox task={task} />
          )}
          {task.valueKind === "number" && <NumberTaskActionInput task={task} />}
          {task.valueKind === "enum" && <EnumTaskActionSelect task={task} />}
        </div>
      ))}
    </div>
  );
}
