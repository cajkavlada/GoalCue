export function getItemsAroundTarget<T>({
  items,
  fromIndex,
  toIndex,
}: {
  items: readonly T[];
  fromIndex: number;
  toIndex: number;
}) {
  if (toIndex > fromIndex) {
    const beforeItem = items[toIndex] ?? null;
    const afterItem =
      toIndex < items.length - 1 ? (items[toIndex + 1] ?? null) : null;

    return { beforeItem, afterItem };
  }

  if (toIndex < fromIndex) {
    const beforeItem = toIndex > 0 ? (items[toIndex - 1] ?? null) : null;
    const afterItem = items[toIndex] ?? null;

    return { beforeItem, afterItem };
  }

  const beforeItem = toIndex > 0 ? (items[toIndex - 1] ?? null) : null;
  const afterItem =
    toIndex < items.length - 1 ? (items[toIndex + 1] ?? null) : null;

  return { beforeItem, afterItem };
}
