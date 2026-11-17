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

1. Choose **Disconnect source → Keep imported Events → Confirm**. Events remain, but further Google changes should no longer sync.
2. Repeat with another demo source and choose **Remove source records**. Its imported Events disappear; unrelated Sources remain.
3. Account-level **Disconnect** applies the keep/remove choice across that connection's Sources. Source-level disconnect affects only the selected calendar.

**Look for throughout:** Google Calendar remains unchanged by GoalCue refreshes and local planning. Connected personal-calendar records are excluded from planning chat context in the current implementation.

**If connection fails immediately:** the deployment needs Google Calendar OAuth and encryption configuration. This is a setup prerequisite, not a calendar-selection mistake. The relevant server settings are in [googleCalendar.ts](../../packages/convex/convex/googleCalendar.ts#L20).
