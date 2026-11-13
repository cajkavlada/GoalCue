## What to build

Automatically place eligible Task Sessions into available time around fixed Events and protected periods. Use priority and deadline pressure to choose what fits, preserve Pins and active work, and keep an existing plan stable when a change would produce only a small optimization. Explain automatic changes and let the user undo or override an individual placement.

## Acceptance criteria

- [ ] GoalCue schedules eligible Sessions using estimated effort, Session bounds, Availability, Events, priority, and deadlines.
- [ ] Replanning runs when a change invalidates the plan or pressing deadline/high-priority work no longer fits; ordinary new Tasks use open time without broad reshuffling.
- [ ] Pins, active Sessions, fixed Events, and Protected periods are respected.
- [ ] When all work cannot fit, GoalCue shows the shortfall and leaves required estimates and deadlines unchanged.
- [ ] Automatic moves are explained and reversible; user placement overrides are respected unless a boundary makes them impossible.

## Blocked by

- 01-schedule-manual-tasks-in-day.md
- 02-manage-availability-and-fixed-events.md
