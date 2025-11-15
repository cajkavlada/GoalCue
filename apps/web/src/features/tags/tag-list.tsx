import { Trash2 } from "lucide-react";

import { m } from "@gc/i18n/messages";
import { useBulkSelect, VirtualList } from "@gc/react-kit";
import { ActionMenu, Checkbox, DropdownMenuItem, useModal } from "@gc/ui";
import { Tag } from "@gc/validators";

import { TagDeleteDialog } from "./tag-delete-dialog";
import { TagListItem } from "./tag-list-item";

export function TagList({
  tags,
  emptyMessage,
}: {
  tags: Tag[];
  emptyMessage: string;
}) {
  const { openDialog } = useModal();
  const { isAllSelected, toggleSelectAll, selectedIds } = useBulkSelect<Tag>();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {tags.length === 0 && (
        <div className="text-center text-gray-500">{emptyMessage}</div>
      )}
      {tags.length > 0 && (
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
                      openDialog(
                        <TagDeleteDialog tagIds={Array.from(selectedIds)} />
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
              items={tags}
              estimateSize={() => 36}
              renderItem={(tag) => <TagListItem tag={tag} />}
            />
          </div>
        </>
      )}
    </div>
  );
}
