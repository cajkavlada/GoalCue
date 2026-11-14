## What to build

Let a user define recurring weekly Availability, date-specific overrides, Protected periods, and fixed Events. Show these constraints in the Day plan so the user can see where commitments and available time fall. Support focused Events and compatible Background Events, with overlap behavior based on the Event's attendance mode.

## Acceptance criteria

- [x] The full day is available by default without setup. A user can optionally enable weekly Availability limits and add, remove, replace, or close time on a specific date.
- [x] A user can create, edit, and delete fixed Events with timezone-aware start and end times.
- [x] Events can be marked focused or as allowing compatible background activity; overlap conflicts are visible.
- [x] Protected periods prevent automatic Task placement.
- [x] Availability and Events appear in the Day view and remain correct across daylight-saving transitions.

## Blocked by

None - can start immediately.
