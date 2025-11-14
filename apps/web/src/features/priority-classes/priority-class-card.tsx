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

import { PriorityClassCreateDrawer } from "./priority-class-create-drawer";
import { PriorityClassList } from "./priority-class-list";
import { priorityClassApi } from "./priority-class.api";

export function PriorityClassCard() {
  return (
    <Card className="min-w-sm flex h-full max-w-md flex-col p-4">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>{m.priorityClasses_heading()}</CardTitle>
        <CardAction>
          <DrawerButton
            drawerContent={<PriorityClassCreateDrawer />}
            size="icon"
            tooltip={m.priorityClasses_create_button_label()}
          >
            <Plus />
          </DrawerButton>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col overflow-hidden">
        <ErrorSuspense>
          <PriorityClassCardList />
        </ErrorSuspense>
      </CardContent>
    </Card>
  );
}

function PriorityClassCardList() {
  const { data: priorityClasses } = priorityClassApi.useList();
  return (
    <SelectableList items={priorityClasses}>
      <PriorityClassList
        priorityClasses={priorityClasses}
        emptyMessage={m.priorityClasses_empty_message()}
      />
    </SelectableList>
  );
}
