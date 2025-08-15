import { getManyFrom } from "convex-helpers/server/relationships";

import { authedQuery } from "./utils/authedFunctions";

export const getAllWithUnitsForUserId = authedQuery({
  args: {},
  handler: async ({ db, userId }) => {
    const taskTypes = await getManyFrom(db, "taskTypes", "by_userId", userId);
    return await Promise.all(
      taskTypes.map(async (taskType) => {
        const unit = await db.get(taskType.unitId);
        if (!unit) {
          throw new Error("Unit not found");
        }
        return { ...taskType, unit };
      })
    );
  },
});
