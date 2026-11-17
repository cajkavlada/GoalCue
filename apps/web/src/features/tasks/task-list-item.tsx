import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";

import { api } from "@gc/convex/api";
import { m } from "@gc/i18n/messages";
import { getLocale } from "@gc/i18n/runtime";
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
  const { data: settings } = useSuspenseQuery(
    convexQuery(api.planning.getSettings, {})
  );
  const { isItemSelected, toggleSelectItem } = useItemSelect(task);

  return (
    <div
      className={cn(
        "flex min-w-0 select-none flex-wrap items-center gap-2 rounded px-1 py-1",
        isItemSelected && "bg-accent text-accent-foreground"
      )}
      onClick={(event) => {
        if (!task.recurrence || task.seriesId) toggleSelectItem(event);
      }}
    >
      <TruncateWithTooltip
        text={task.title}
        className="min-w-0 flex-1 basis-24"
      />
      {task.seriesId && (
        <span className="text-muted-foreground text-xs">
          {task.expiredAt !== undefined
            ? m.recurrence_expired()
            : m.recurrence_occurrence()}{" "}
          ·{" "}
          {new Intl.DateTimeFormat(getLocale(), {
            dateStyle: "medium",
            timeZone: settings?.timezone,
          }).format(task.occurrenceStartAt)}
        </span>
      )}
      {task.recurrence && !task.seriesId && (
        <span className="text-muted-foreground text-xs">
          {m.recurrence_title()}
        </span>
      )}
      <div
        className="flex min-w-0 max-w-full flex-wrap items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {(!task.recurrence || task.seriesId) &&
          task.valueKind === "boolean" && (
            <BoolTaskActionCheckbox
              task={task}
              completedAfter={completedAfter}
            />
          )}
        {(!task.recurrence || task.seriesId) && task.valueKind === "number" && (
          <NumberTaskActionInput
            key={task.progressMeasure}
            task={task}
            completedAfter={completedAfter}
          />
        )}
        {(!task.recurrence || task.seriesId) && task.valueKind === "enum" && (
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
