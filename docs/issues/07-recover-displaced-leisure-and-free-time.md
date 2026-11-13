## What to build

Track leisure Sessions shortened or displaced by automatic planning separately from manual skips and moves that preserve duration. When GoalCue borrows eligible leisure time or free-time reserve to fit pressing work, create a bounded recovery opportunity and make it visible in later plans.

## Acceptance criteria

- [ ] Automatic displacement records lost leisure duration and does not count manual skips as displacement.
- [ ] Recovery restores an opportunity for the same activity; substitute activities or generic free time require user permission.
- [ ] Recovery requests expire after the configured window and share the configured daily recovery cap.
- [ ] Borrowed free-time reserve is tracked separately and restored as unallocated time.
- [ ] Repeated displacement is surfaced as a planning imbalance without accumulating indefinite debt.

## Blocked by

- 03-automatically-plan-and-stabilize-day.md
- 04-check-in-on-sessions-and-replan.md
