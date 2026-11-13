## What to build

At the end of a scheduled Session, let the user report that the Task is finished, partially progressed, not done, or still in progress. Preserve the Session record and update the remaining Task plan from the user's report. Unanswered check-ins remain unknown and do not imply completion or failure.

## Acceptance criteria

- [ ] A nonblocking check-in offers Finished, Made progress, Didn't do it, Still working, and Ask later.
- [ ] Partial progress updates the Task's configured measure and preserves recorded time separately.
- [ ] Finished work completes the applicable Task or Occurrence; estimated effort alone never completes it.
- [ ] Missed or extended work triggers a minimal replan without silently moving fixed commitments or protected boundaries.
- [ ] Later corrections and undo replace the prior progress contribution rather than counting it twice.

## Blocked by

- 03-automatically-plan-and-stabilize-day.md
