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
import { Unit } from "@gc/validators";

import { UnitDeleteDialog } from "./unit-delete-dialog";
import { UnitEditDrawer } from "./unit-edit-drawer";

export function UnitListItem({ unit }: { unit: Unit }) {
  const { openDialog, openDrawer } = useModal();
  const { isItemSelected, toggleSelectItem } = useItemSelect(unit);
  return (
    <div
      className={cn(
        "flex select-none items-center gap-2 px-2",
        isItemSelected && "bg-accent text-accent-foreground"
      )}
      onClick={toggleSelectItem}
    >
      <TruncateWithTooltip
        text={unit.name}
        className="mr-auto"
      />
      <div onClick={(e) => e.stopPropagation()}>
        <ActionMenu>
          <DropdownMenuItem
            onClick={() => openDrawer(<UnitEditDrawer editedUnit={unit} />)}
          >
            <Pencil />
            {m.edit()}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openDialog(<UnitDeleteDialog unit={unit} />)}
          >
            <Trash2 className="text-red-700" />
            {m.delete()}
          </DropdownMenuItem>
        </ActionMenu>
      </div>
    </div>
  );
}
