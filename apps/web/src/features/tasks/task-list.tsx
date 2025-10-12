import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import { CircleQuestionMark, ListChecks, Trash2 } from "lucide-react";

import { api } from "@gc/convex/api";
import { m } from "@gc/i18n/messages";
import { useBulkSelect, VirtualList } from "@gc/react-kit";
import {
  ActionMenu,
  Checkbox,
  DropdownMenuItem,
  Tooltip,
  useDialog,
} from "@gc/ui";
import { ExtendedTask } from "@gc/validators";

import { TaskDeleteDialog } from "./task-delete-dialog";
import { TaskListItem } from "./task-list-item";

export function TaskList({
  tasks,
  completedAfter,
  emptyMessage,
}: {
  tasks: ExtendedTask[];
  completedAfter?: number;
  emptyMessage?: string;
}) {
  const { isAllSelected, toggleSelectAll, selectedIds } =
    useBulkSelect<ExtendedTask>();
  const { openDialog } = useDialog();
  const addToCompletedMutation = useMutation({
    mutationFn: useConvexMutation(api.taskActions.addToCompleted),
  });
  const addToInitialMutation = useMutation({
    mutationFn: useConvexMutation(api.taskActions.addToInitial),
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {tasks.length === 0 && (
        <div className="text-center text-gray-500">{emptyMessage}</div>
      )}
      {tasks.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={toggleSelectAll}
            />
            {selectedIds.size > 0 && (
              <>
                {selectedIds.size}
                <ActionMenu>
                  <DropdownMenuItem
                    onClick={() =>
                      completedAfter
                        ? addToInitialMutation.mutate({
                            taskIds: Array.from(selectedIds),
                          })
                        : addToCompletedMutation.mutate({
                            taskIds: Array.from(selectedIds),
                          })
                    }
                  >
                    <ListChecks />
                    {completedAfter
                      ? m.tasks_bulk_mark_as_initial_label()
                      : m.tasks_bulk_mark_as_completed_label()}
                    <Tooltip
                      content={
                        completedAfter
                          ? m.tasks_bulk_mark_as_initial_tooltip()
                          : m.tasks_bulk_mark_as_completed_tooltip()
                      }
                    >
                      <CircleQuestionMark />
                    </Tooltip>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      openDialog(
                        <TaskDeleteDialog taskIds={Array.from(selectedIds)} />
                      )
                    }
                  >
                    <Trash2 className="text-red-700" />
                    {m.delete()}
                  </DropdownMenuItem>
                </ActionMenu>
              </>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            {tasks.length > 0 && (
              <VirtualList
                className="h-full"
                items={tasks}
                estimateSize={() => 30}
                renderItem={(task) => (
                  <TaskListItem
                    task={task}
                    completedAfter={completedAfter}
                  />
                )}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
