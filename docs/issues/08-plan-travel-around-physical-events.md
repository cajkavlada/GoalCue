## What to build

Represent physical, online, hybrid, and unknown Event attendance, then plan Journeys and separate route, travel-margin, arrival, and wrap-up buffers. Use only the minimum location and timing data required for routing, and surface uncertainty or impossible transitions instead of silently assuming zero travel time.

## Acceptance criteria

- [ ] Events and Tasks can carry an attendance mode and editable location requirement.
- [ ] Online Events require no travel; physical Events can create Journeys with mode, route duration, travel margin, and arrival buffer.
- [ ] External routing is used only with permission; otherwise the user can enter travel time manually.
- [ ] Infeasible travel is shown with options while fixed Events remain fixed.
- [ ] Compatible errands can share a Journey when doing so does not destabilize the plan.

## Blocked by

- 02-manage-availability-and-fixed-events.md
- 03-automatically-plan-and-stabilize-day.md
