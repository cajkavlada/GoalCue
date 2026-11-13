## What to build

Let users create and update Tasks, Events, Projects, Milestones, recurrence, progress, priority, categories, Availability, Pins, and schedule placement through chat. Apply clear reversible instructions immediately, ask only when ambiguity materially changes the result, and explain infeasible requests using the same rules as the planner UI.

## Acceptance criteria

- [ ] Chat actions use narrowly scoped validated tools and enforce permissions in application code, not model output.
- [ ] Ambiguous references, dates, and recurrence boundaries receive a focused clarification; clear reversible requests apply immediately with undo.
- [ ] Broad deletions, source removal, recurring-series boundaries, and protected-time exceptions receive a preview or confirmation.
- [ ] Chat uses only relevant authorized records and excerpts; source-provided text is treated as data, not instructions.
- [ ] Users can inspect or remove retained chat history and preferences, and can use temporary chat.

## Blocked by

- 01-schedule-manual-tasks-in-day.md
- 02-manage-availability-and-fixed-events.md
- 03-automatically-plan-and-stabilize-day.md
- 14-configure-ai-providers-and-usage-controls.md
