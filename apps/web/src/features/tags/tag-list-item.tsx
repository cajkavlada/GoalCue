import { Pencil, Trash2 } from "lucide-react";

import { m } from "@gc/i18n/messages";
import { useItemSelect } from "@gc/react-kit";
import {
  ActionMenu,
  DropdownMenuItem,
  TruncateWithTooltip,
  useModal,
} from "@gc/ui";
import { cn } from "@gc/utils";
import { Tag } from "@gc/validators";

import { TagDeleteDialog } from "./tag-delete-dialog";
import { TagEditDrawer } from "./tag-edit-drawer";

export function TagListItem({ tag }: { tag: Tag }) {
  const { openDialog, openDrawer } = useModal();
  const { isItemSelected, toggleSelectItem } = useItemSelect(tag);
  return (
    <div
      className={cn(
        "flex select-none items-center gap-2 px-2",
        isItemSelected && "bg-accent text-accent-foreground"
      )}
      onClick={toggleSelectItem}
    >
      <TruncateWithTooltip
        text={tag.name}
        className="mr-auto"
      />
      <div onClick={(e) => e.stopPropagation()}>
        <ActionMenu>
          <DropdownMenuItem
            onClick={() => openDrawer(<TagEditDrawer editedTag={tag} />)}
          >
            <Pencil />
            {m.edit()}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openDialog(<TagDeleteDialog tag={tag} />)}
          >
            <Trash2 className="text-red-700" />
            {m.delete()}
          </DropdownMenuItem>
        </ActionMenu>
      </div>
    </div>
  );
}
