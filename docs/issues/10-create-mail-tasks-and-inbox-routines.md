## What to build

Let users select personal mail folders or labels and create linked Tasks or Reply Tasks from actionable messages. Add recurring, time-boxed Inbox review and Spam cleanup Tasks that operate on a bounded batch and remain usable manually when mail access is unavailable.

## Acceptance criteria

- [ ] Users can select mail folders/labels and choose whether bodies, thread context, and attachments may be processed.
- [ ] A message can create one or more linked Tasks or Reply Tasks without changing mailbox state.
- [ ] New related messages update linked actions without creating duplicates; unrelated messages remain separate.
- [ ] Inbox review and Spam cleanup are configurable recurring Tasks with defaults of 15 minutes on weekdays and 10 minutes weekly.
- [ ] Mail content and AI processing follow source permissions, retention, and exclusion rules; suggested replies identify missing user input.

## Blocked by

- 01-schedule-manual-tasks-in-day.md
- 05-schedule-recurring-tasks.md
