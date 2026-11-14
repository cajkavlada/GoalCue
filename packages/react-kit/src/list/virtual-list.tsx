import { useEffect, useRef } from "react";
import { PartialKeys, useVirtualizer } from "@tanstack/react-virtual";

import { cn } from "@gc/utils";

type VirtualizerOptions = PartialKeys<
  Parameters<typeof useVirtualizer>[0],
  "count" | "getScrollElement"
>;

export function VirtualList<T>({
  items,
  className,
  renderItem,
  onEndReached,
  ...props
}: {
  items: T[];
  className?: string;
  renderItem: (item: T) => React.ReactNode;
  onEndReached?: () => void;
} & VirtualizerOptions) {
  const parentRef = useRef(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    ...props,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const lastVisibleIndex = virtualItems[virtualItems.length - 1]?.index;
  useEffect(() => {
    if (lastVisibleIndex !== undefined && lastVisibleIndex >= items.length - 5)
      onEndReached?.();
  }, [lastVisibleIndex, items.length, onEndReached]);
  return (
    <div
      ref={parentRef}
      className={cn("overflow-auto", className)}
    >
      <ul
        className="relative w-full"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {virtualItems.map((virtualItem) => (
          <li
            key={virtualItem.key}
            className="absolute left-0 top-0 w-full"
            style={{
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index]!)}
          </li>
        ))}
      </ul>
    </div>
  );
}
