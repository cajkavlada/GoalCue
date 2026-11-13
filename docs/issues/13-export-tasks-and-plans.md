## What to build

Provide user-triggered exports of Tasks and schedule data in portable formats. Export only the information needed for each format, preserve timezone and progress semantics, and never write changes back to connected calendar, mail, or Jira sources.

## Acceptance criteria

- [ ] A user can export their full data as JSON and Tasks as CSV.
- [ ] A user can export selected planned Events and Sessions as ICS.
- [ ] Exports preserve source links, recurrence, timezone, primary progress measure, and relevant planning fields.
- [ ] Export scope is shown before file creation and can be limited by date, Project, or source.
- [ ] Exporting never updates or deletes records in connected services.

## Blocked by

- 09-import-personal-calendar-read-only.md
- 11-import-work-calendar-files.md
- 12-import-and-balance-jira-tasks.md
