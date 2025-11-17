import { Id, TableNames } from "../_generated/dataModel";

export function getIdsToAddAndRemoveforUpdate<T extends TableNames>(
  currentIds: Id<T>[],
  newIds: Id<T>[]
) {
  const currentIdsSet = new Set(currentIds);
  const newIdsSet = new Set(newIds);

  const idsToAdd = newIds.filter((id) => !currentIdsSet.has(id));
  const idsToRemove = currentIds.filter((id) => !newIdsSet.has(id));

  return { idsToAdd, idsToRemove };
}
