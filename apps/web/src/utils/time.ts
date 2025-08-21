export function getYesterdayTimestamp() {
  const now = Date.now();
  return now - (now % (1000 * 60 * 60)) - 1000 * 60 * 60 * 24;
}
