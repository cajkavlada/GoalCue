import { useRef } from "react";
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
  ...props
}: {
  items: T[];
  className?: string;
  renderItem: (item: T) => React.ReactNode;
} & VirtualizerOptions) {
  const parentRef = useRef(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    ...props,
  });
  return (
    <div
      ref={parentRef}
      className={cn("overflow-auto", className)}
    >
      <ul
        className="relative w-full"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualItem) => (
          <li
            key={virtualItem.index}
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
