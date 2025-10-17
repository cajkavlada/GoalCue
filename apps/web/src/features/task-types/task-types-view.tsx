import { m } from "@gc/i18n/messages";
import { SelectableList } from "@gc/react-kit";

import { TaskTypeList } from "./task-type-list";
import { useTaskTypes } from "./use-task-types";

export function TaskTypesView() {
  const { data: taskTypes } = useTaskTypes();
  return (
    <SelectableList items={taskTypes}>
      <TaskTypeList
        taskTypes={taskTypes}
        emptyMessage={m.taskTypes_empty_message()}
      />
    </SelectableList>
  );
}
