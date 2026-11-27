# #225 — Read-only personal calendars

[Issue](https://github.com/cajkavlada/GoalCue/issues/225) · [All guides](README.md)

**Benefit:** personal appointments block the plan without copying them manually or giving GoalCue permission to edit Google Calendar.

## Try: import a test calendar

1. In your personal Google account, create a separate calendar `GoalCue demo`. Add a future timed appointment, an all-day Event and a recurring appointment. Give the timed one a location and meeting link.
2. Open Settings → Personal calendars. Choose **Busy-only**, connect Google, tick only `GoalCue demo`, then **Import selected calendars**.
3. Open the relevant dates in Day view.

**Look for:** occupied time appears without private titles/details. Automatic planning avoids busy time. Refresh the source twice: the same appointments should remain single Events.

## Try each option

- **Busy-only:** use when only occupied time is needed. Check that title, description, location and meeting link are not exposed as full appointment details.
- **Full events:** repeat connection/import using a separate demo calendar and Full events. Check its title, all-day dates, recurrence, timezone, location and meeting link where supplied.
- **Calendar selection:** connect an account with two calendars but select one. Only that calendar's Events should enter the plan.
- **Refresh:** move the timed appointment in Google, then refresh. Its linked Event should update, with no duplicate at the old time.
- **Cancellation:** cancel one recurring occurrence in Google and refresh. That occurrence should stop blocking time; the others remain.
- **Transparent/free Event:** mark a demo Event as free in Google. Check it does not consume busy time like a busy appointment.
- **Timezone / all-day:** create an Event in another timezone and an all-day Event. Compare instants and local dates in GoalCue; all-day should not unexpectedly shift a day.
- **Staleness:** the UI marks a source stale after six minutes without success and shows a banner in the plan. Refresh should update its last-success time.
- **Refresh failure:** in a test environment, revoke the Google grant and refresh. A visible failure should preserve previously imported Events, rather than make the day appear empty.

## Try: disconnect choices

Use only the demo source:

1. Choose **Disconnect source**. **Remove imported events from GoalCue** starts checked. Uncheck it, cancel by toggling **Disconnect source**, and reopen: it should be checked again. Uncheck and confirm to retain Events; further Google changes should no longer sync.
2. Repeat with another demo source and confirm with the checkbox checked. All its imported Events, including recurring occurrences, disappear; unrelated Sources and manual Events remain.
3. Account-level **Disconnect** has the same checked default and reset behavior, and applies the choice across that connection’s Sources. Source-level disconnect affects only the selected calendar.
4. Open a retained Event’s details and use **Delete Event**, as for a manual Event. It disappears and its time becomes available to the plan. Repeat with an Event retained before this change. Active-calendar Events must not show this action; backend deletion must reject active-calendar Events and another user’s Events.
5. Verify the original appointments still exist in Google Calendar after both disconnect cleanup and individual deletion.

**Look for throughout:** Google Calendar remains unchanged by GoalCue refreshes and local planning. Connected personal-calendar records are excluded from planning chat context in the current implementation.

**If connection fails immediately:** the deployment needs Google Calendar OAuth and encryption configuration. This is a setup prerequisite, not a calendar-selection mistake. The relevant server settings are in [googleCalendar.ts](../../packages/convex/convex/googleCalendar.ts#L20).

## Settings routes and OAuth deployment migration

Settings opens Planning time at `/settings/planning-time` by default. Personal calendars is at `/settings/personal-calendars`. Each path also supports the optional locale prefix, for example `/cs/settings/personal-calendars`.

For every applicable Convex deployment (development, preview, and production), change `GOOGLE_CALENDAR_APP_URL` to the full frontend Personal calendars URL, for example `https://<app-host>/settings/personal-calendars` or `https://<app-host>/cs/settings/personal-calendars`. Keep the configured locale prefix when used. Existing deployment values pointing at `/settings` continue to work through a compatibility redirect.

The Google Cloud authorized redirect URI stays `<CONVEX_SITE_URL>/calendar/google/callback`. It is the backend callback, not the frontend Settings URL.

### Check the settings navigation

- Visit each subsection directly: `mail`, `personal-calendars`, `planning-time`, `jira-import`, `work-calendars`, `task-types`, `units`, `priority-classes`, and `tags` under `/settings/`. Only the selected panel should render.
- Reload a subsection, switch sections, and use browser Back/Forward. Repeat with `/cs/settings/…`; links and redirects must retain the locale.
- Open `/settings` without callback parameters: it should replace the URL with Planning time. Check that Settings remains highlighted in the main navigation.
- At desktop width, check the sidebar and adjacent panel. At mobile width, check the wrapping navigation, readable labels, and absence of horizontal page overflow. Tab through links and use Enter to open a section; the current section should have a visible active state.
- Complete Google authorization with the new deployment value. Confirm the result appears in Personal calendars and `calendarState` / `calendarCode` disappear from the URL after completion.
- Repeat authorization with `GOOGLE_CALENDAR_APP_URL` temporarily targeting legacy `/settings` (and a locale-prefixed equivalent). Callback parameters must forward to Personal calendars before authorization runs.
- Try missing, invalid, and oversized callback parameters. State is bounded to 128 characters and code to 4096; invalid values are discarded. Confirm failure feedback still appears for a rejected authorization and parameters are cleared after the attempt.
- From a stale-calendar banner in the plan, follow Manage calendars: it should open Personal calendars.
