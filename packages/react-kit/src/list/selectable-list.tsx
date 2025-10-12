import { createContext, useContext, useEffect, useState } from "react";

export type CheckedState = boolean | "indeterminate";
export type ItemWithId = { _id: string };

type SelectionContextType<T extends ItemWithId> = {
  selectedIds: Set<T["_id"]>;
  isItemSelected: (id: T["_id"]) => boolean;
  toggleSelectItem: (id: T["_id"], selected: CheckedState) => void;
  isAllSelected: CheckedState;
  toggleSelectAll: (selected: CheckedState) => void;
  selectedItemsCount: number;
};

const SelectionContext = createContext<SelectionContextType<ItemWithId> | null>(
  null
);

export function SelectableList<T extends ItemWithId>({
  children,
  items,
}: {
  children: React.ReactNode;
  items: T[];
}) {
  const [selectedIds, setSelectedIds] = useState<Set<T["_id"]>>(new Set());

  useEffect(() => {
    setSelectedIds((prev) => {
      const validIds = new Set(items.map((i) => i._id));
      return new Set([...prev].filter((id) => validIds.has(id)));
    });
  }, [items]);

  function isItemSelected(id: T["_id"]) {
    return selectedIds.has(id);
  }
  function toggleSelectItem(id: T["_id"], selected: CheckedState) {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  }
  function getIsAllSelected(): CheckedState {
    if (selectedIds.size === 0) return false;
    if (selectedIds.size === items.length) return true;
    return "indeterminate";
  }

  function toggleSelectAll(selected: CheckedState) {
    if (selected) {
      setSelectedIds(new Set(items.map((item) => item._id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  const providerValue = {
    selectedIds,
    isItemSelected,
    toggleSelectItem,
    isAllSelected: getIsAllSelected(),
    toggleSelectAll,
    selectedItemsCount: selectedIds.size,
  };
  return <SelectionContext value={providerValue}>{children}</SelectionContext>;
}

export function useBulkSelect<T extends ItemWithId>() {
  const selectableContext = useContext(SelectionContext);
  if (!selectableContext) {
    throw new Error(
      "useBulkSelect must be used within a SelectableListProvider"
    );
  }
  const { isAllSelected, toggleSelectAll, selectedItemsCount, selectedIds } =
    selectableContext;
  return {
    isAllSelected,
    toggleSelectAll,
    selectedItemsCount,
    selectedIds: selectedIds as Set<T["_id"]>,
  };
}

export function useItemSelect<T extends ItemWithId>(item: T) {
  const selectableContext = useContext(SelectionContext);
  if (!selectableContext) {
    throw new Error(
      "useSelectItem must be used within a SelectableListProvider"
    );
  }
  const { isItemSelected, toggleSelectItem } = selectableContext;
  return {
    isItemSelected: isItemSelected(item._id),
    toggleSelectItem: (selected: CheckedState) =>
      toggleSelectItem(item._id, selected),
  };
}
