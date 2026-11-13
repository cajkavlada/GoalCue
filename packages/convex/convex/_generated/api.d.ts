/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as dbQueries_index from "../dbQueries/index.js";
import type * as priorityClasses from "../priorityClasses.js";
import type * as sessions from "../sessions.js";
import type * as tags from "../tags.js";
import type * as taskActions from "../taskActions.js";
import type * as taskTypes from "../taskTypes.js";
import type * as tasks from "../tasks.js";
import type * as units from "../units.js";
import type * as users from "../users.js";
import type * as utils_authedFunctions from "../utils/authedFunctions.js";
import type * as utils_rateLimiter from "../utils/rateLimiter.js";
import type * as utils_relationsUtils from "../utils/relationsUtils.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "dbQueries/index": typeof dbQueries_index;
  priorityClasses: typeof priorityClasses;
  sessions: typeof sessions;
  tags: typeof tags;
  taskActions: typeof taskActions;
  taskTypes: typeof taskTypes;
  tasks: typeof tasks;
  units: typeof units;
  users: typeof users;
  "utils/authedFunctions": typeof utils_authedFunctions;
  "utils/rateLimiter": typeof utils_rateLimiter;
  "utils/relationsUtils": typeof utils_relationsUtils;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
