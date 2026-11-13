## What to build

Allow users to import work-calendar files such as ICS without connecting a work account. Map imported entries to fixed Events with stable source identity, support repeat imports, and show import errors without discarding a prior successful import.

## Acceptance criteria

- [ ] A user can import an ICS file and review parsed Events before or after applying the import.
- [ ] All-day dates, timezones, recurrence, cancellations, locations, and meeting links are preserved where present.
- [ ] Reimport updates linked Events without duplicates and preserves local planning overrides.
- [ ] Missing source entries are removed only after a successful full refresh of the declared scope.
- [ ] Work data remains excluded from AI processing unless the user explicitly enables that source.

## Blocked by

- 02-manage-availability-and-fixed-events.md
