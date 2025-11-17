import { Id, TableNames } from "../_generated/dataModel";

export function getIdsToAddAndRemoveforUpdate<T extends TableNames>({
  originalIds,
  newIds,
}: {
  originalIds: Id<T>[];
  newIds: Id<T>[];
}) {
  const originalIdsSet = new Set(originalIds);
  const newIdsSet = new Set(newIds);

  const idsToAdd = newIds.filter((id) => !originalIdsSet.has(id));
  const idsToRemove = originalIds.filter((id) => !newIdsSet.has(id));

  return { idsToAdd, idsToRemove };
}
