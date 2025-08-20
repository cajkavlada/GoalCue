import { getManyFrom } from "convex-helpers/server/relationships";

import { authedQuery } from "./utils/authedFunctions";

export const getAllForUserId = authedQuery({
  args: {},
  handler: async ({ db, userId }) => {
    return await getManyFrom(db, "taskTypes", "by_userId", userId);
  },
});
