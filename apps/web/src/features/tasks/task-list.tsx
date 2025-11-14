import { CircleQuestionMark, ListChecks, Trash2 } from "lucide-react";

import { m } from "@gc/i18n/messages";
import { useBulkSelect, VirtualList } from "@gc/react-kit";
import {
  ActionMenu,
  Checkbox,
  DropdownMenuItem,
  Tooltip,
  useModal,
} from "@gc/ui";
import { cn } from "@gc/utils";
import { ExtendedTask } from "@gc/validators";

import { taskActionApi } from "../task-actions/task-action.api";
import { TaskDeleteDialog } from "./task-delete-dialog";
import { TaskListItem } from "./task-list-item";

export function TaskList({
  tasks,
  completedAfter,
  emptyMessage,
  className,
}: {
  tasks: ExtendedTask[];
  completedAfter?: number;
  emptyMessage?: string;
  className?: string;
}) {
  const { openDialog } = useModal();

  const { isAllSelected, toggleSelectAll, selectedIds } =
    useBulkSelect<ExtendedTask>();

  const addToCompletedMutation = taskActionApi.useAddToCompleted();

  const addToInitialMutation = taskActionApi.useAddToInitial();

  return (
    <div className={cn("flex flex-1 flex-col overflow-hidden", className)}>
      {tasks.length === 0 && (
        <div className="text-center text-gray-500">{emptyMessage}</div>
      )}
      {tasks.length > 0 && (
        <>
          <div className="flex h-[36px] items-center gap-2 pl-1 pr-2">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={toggleSelectAll}
            />
            {selectedIds.size > 0 && (
              <>
                <p className="min-w-[20px]">{selectedIds.size}</p>
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
            <VirtualList
              className="h-full"
              items={tasks}
              estimateSize={() => 36}
              renderItem={(task) => (
                <TaskListItem
                  task={task}
                  completedAfter={completedAfter}
                />
              )}
            />
          </div>
        </>
      )}
    </div>
  );
}
