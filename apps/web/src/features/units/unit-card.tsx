import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { api } from "@gc/convex/api";
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

import { UnitCreateDrawer } from "./unit-create-drawer";
import { UnitList } from "./unit-list";

export function UnitCard() {
  return (
    <Card className="min-w-sm flex h-full max-w-md flex-col p-4">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>{m.units_heading()}</CardTitle>
        <CardAction>
          <DrawerButton
            drawerContent={<UnitCreateDrawer />}
            size="icon"
            tooltip={m.units_create_button_label()}
          >
            <Plus />
          </DrawerButton>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col overflow-hidden">
        <ErrorSuspense>
          <UnitCardList />
        </ErrorSuspense>
      </CardContent>
    </Card>
  );
}

function UnitCardList() {
  const { data: units } = useSuspenseQuery(
    convexQuery(api.units.getAllForUserId, {})
  );
  return (
    <SelectableList items={units}>
      <UnitList
        units={units}
        emptyMessage={m.units_empty_message()}
      />
    </SelectableList>
  );
}
