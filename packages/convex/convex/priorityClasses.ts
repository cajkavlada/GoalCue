import { getManyFrom } from "convex-helpers/server/relationships";

import { authedQuery } from "./utils/authedFunctions";

export const getAllForUserId = authedQuery({
  args: {},
  handler: async ({ db, userId }) => {
    const priorityClasses = await getManyFrom(
      db,
      "priorityClasses",
      "by_userId",
      userId
    );
    return priorityClasses.sort((a, b) => b.order.localeCompare(a.order));
  },
});
