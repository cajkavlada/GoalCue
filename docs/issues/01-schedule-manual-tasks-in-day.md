## What to build

Extend the existing Task workflow so a user can enter planning details, place a Task into a specific Day, and see it in the primary Day view. A Task supports an optional effort estimate, a user-selected priority, a firm deadline or preferred finish date, and one primary progress measure. Scheduled work is represented by Sessions; a Task may require more than one Session. Editing the plan updates the existing Task rather than creating a duplicate.

## Acceptance criteria

- [ ] A user can create and edit a Task with optional effort, priority, finish date/deadline, and progress measure.
- [ ] A user can schedule, move, and resize a Task Session in the Day view; resizing changes planned duration, not progress.
- [ ] Tasks and Sessions persist per user and remain consistent after reload.
- [ ] The Day view shows unscheduled Tasks and identifies Tasks that cannot fit in the displayed Day.
- [ ] Existing Task creation and tracking continue to work.

## Blocked by

None - can start immediately.
