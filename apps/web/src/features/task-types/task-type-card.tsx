import { Plus } from "lucide-react";

import { m } from "@gc/i18n/messages";
import { ErrorSuspense, SelectableList } from "@gc/react-kit";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
  DrawerButton,
} from "@gc/ui";

import { TaskTypeCreateDrawer } from "./task-type-create-drawer";
import { TaskTypeList } from "./task-type-list";
import { taskTypeApi } from "./task-type.api";

export function TaskTypeCard() {
  return (
    <Card className="min-w-sm flex h-full max-w-md flex-col p-4">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>{m.taskTypes_heading()}</CardTitle>
        <CardAction>
          <DrawerButton
            drawerContent={<TaskTypeCreateDrawer />}
            size="icon"
            tooltip={m.taskTypes_create_button_label()}
          >
            <Plus />
          </DrawerButton>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col overflow-hidden">
        <ErrorSuspense>
          <TaskTypeCardList />
        </ErrorSuspense>
      </CardContent>
    </Card>
  );
}

function TaskTypeCardList() {
  const { data: taskTypes } = taskTypeApi.useList();
  return (
    <SelectableList items={taskTypes}>
      <TaskTypeList
        taskTypes={taskTypes}
        emptyMessage={m.taskTypes_empty_message()}
      />
    </SelectableList>
  );
}
