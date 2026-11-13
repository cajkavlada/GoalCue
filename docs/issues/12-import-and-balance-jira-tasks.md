## What to build

Import Jira issues from user-selected CSV files and map them to linked Tasks. Preserve board membership and source identity, estimate remaining work without converting story points into hours, and distribute work across boards using effort, deadlines, configured Project time, and daily variety.

## Acceptance criteria

- [ ] A user can map CSV columns for issue identity, summary, description, status, priority, assignee, due date, estimates, Project/parent, board, and sprint.
- [ ] Reimports update linked Tasks without duplicates and preserve local planning edits and progress.
- [ ] Story points remain separate from time estimates; configured rules may use remaining time or a documented estimate fallback.
- [ ] Sprint end dates are preferred finishes unless explicitly marked firm; future sprint dates are never invented.
- [ ] Board balancing gives meaningful attention across eligible boards while surfacing genuine firm-deadline risk.

## Blocked by

- 01-schedule-manual-tasks-in-day.md
- 03-automatically-plan-and-stabilize-day.md
- 06-plan-projects-across-week-and-month.md
