## What to build

Allow users to select personal calendars for read-only import and show imported Events in the plan. Support busy-only access, stable source identity, refresh and cancellation handling, and a visible indication when a calendar is stale or a refresh fails.

## Acceptance criteria

- [ ] Users can choose calendars and grant full-event or busy-only access.
- [ ] Imported Events retain source identity, timezone, recurrence, all-day dates, location, meeting link, cancellation, and status where available.
- [ ] Refreshes update existing linked Events and do not create duplicates or write back to the calendar.
- [ ] Failed or stale refreshes preserve prior data and are visible to the user.
- [ ] Disconnecting a source stops access and offers the specified keep-or-remove behavior for derived data.

## Blocked by

- 02-manage-availability-and-fixed-events.md
