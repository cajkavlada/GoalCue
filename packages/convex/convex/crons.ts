import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval(
  "Refresh personal calendars",
  { minutes: 5 },
  internal.calendars.refreshDue,
  {}
);
export default crons;
