import { startOfHour, subDays } from "date-fns";

export function getYesterdayTimestamp() {
  const now = Date.now();
  return subDays(startOfHour(now), 1).getTime();
}
