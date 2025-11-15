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

import { TagCreateDrawer } from "./tag-create-drawer";
import { TagList } from "./tag-list";
import { tagApi } from "./tag.api";

export function TagCard() {
  return (
    <Card className="min-w-sm flex h-full max-w-md flex-col p-4">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>{m.tags_heading()}</CardTitle>
        <CardAction>
          <DrawerButton
            drawerContent={<TagCreateDrawer />}
            size="icon"
            tooltip={m.tags_create_button_label()}
          >
            <Plus />
          </DrawerButton>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col overflow-hidden">
        <ErrorSuspense>
          <TagCardList />
        </ErrorSuspense>
      </CardContent>
    </Card>
  );
}

function TagCardList() {
  const { data: tags } = tagApi.useList();
  return (
    <SelectableList items={tags}>
      <TagList
        tags={tags}
        emptyMessage={m.tags_empty_message()}
      />
    </SelectableList>
  );
}
