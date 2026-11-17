# #223 — Recover displaced leisure and free-time reserve

[Issue](https://github.com/cajkavlada/GoalCue/issues/223) · [All guides](README.md)

**Benefit:** urgent work can borrow flexible leisure, while GoalCue offers that same activity again later. This restores an opportunity, not a requirement to do extra work.

## Try: urgent work replaces reading

1. In Settings → Planning time, restrict Availability on a future test date to **09:00–12:00**. Keep another day within the following week available. Use the same timezone everywhere. Remove unrelated work and fixed Events from the test window.
2. Create `Demo reading`: 60-minute effort, low Priority, **Leisure Task on**, minimum Session 30 minutes. Leave its recovery window blank (default 7 days).
3. Run automatic planning for that date. Verify reading has an **automatic**, unpinned Session in the morning. A manually placed Session is protected from this displacement.
4. Create `Demo urgent work`: 180-minute effort, critical Priority, **firm deadline at 12:00 on the test date**. Run automatic planning again if needed.
5. Expand **Leisure and free-time recovery** in Day view; inspect later days in the planning horizon.

**Look for:** work fills the three-hour window. Reading loses 60 minutes and gets a 60-minute Recovery request, with an expiry date. A later compatible opening receives a **Recovery Session for reading**, not a different activity. It may already say “Opportunity restored” because scheduling the opportunity counts as restoration; completion is separate.

If reading simply moves and retains all 60 minutes, no leisure was lost: no Recovery request is expected. If it was planned on another day initially, tighten its finish date or inspect the selected Day before adding work.

## Try each option

- **Leisure Task off:** repeat with an ordinary flexible Task. Losing its slot should not create leisure recovery.
- **Manual skip:** skip a reading Session yourself. No new Recovery request should appear.
- **Pin / protected time:** pin reading or use a Protected period. Urgent work should show a shortfall rather than borrow that protected time.
- **Task recovery window = 3:** override the default on reading, then cause fresh displacement. Its new request should expire three days after displacement.
- **Extend window:** on an unfulfilled request, click this and check its expiry moves later.
- **Dismiss:** dismiss an unfulfilled test request; it should stop generating recovery opportunities.
- **Expiry:** inspect an unfulfilled request after its expiry. It should say expired, with no indefinite recovery debt.
- **Repeated losses:** cause repeated displacement on several dates. Look for a planning imbalance warning, not endless debt accumulation.

## Free-time reserve and global settings

**Current blocker:** Settings displays these fields but does not submit them. Change a value, save, reload: if it resets, this is the implementation gap, not a misunderstood option. See [Settings submit](../../apps/web/src/features/tasks/schedule-constraints.tsx#L194).

After persistence is fixed, or a developer saves these through authenticated `planning.saveSettings`, try:

1. Set preferred reserve **60**, protected minimum **30**, daily recovery cap **30**, recovery window **7**. Give one date 180 available minutes.
2. Add critical work needing 150 minutes. The planner may borrow 30 minutes of preferred reserve but must retain 30 unallocated minutes.
3. On later roomy days, inspect recovery allocations: reserve recovery stays **unallocated time**, with no fake free-time Task.
4. Displace reading too. Reserve and leisure recovery together must use at most 30 minutes per day.

**Option meaning:** preferred reserve is the desired breathing room; minimum is the protected floor; daily cap limits all recovery combined; window limits how long recovery is attempted. Defaults are 0 reserve, 60-minute cap and 7-day window. A cap of 0 leaves no capacity for recovery.
