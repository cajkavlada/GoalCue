# #227 — Import work Events from ICS

[Issue](https://github.com/cajkavlada/GoalCue/issues/227) · [All guides](README.md)

**Benefit:** block work meetings in GoalCue without connecting your work account.

## Try: a meeting and an all-day Event

Save this as `demo-calendar.ics` using a text editor:

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//GoalCue Demo//EN
BEGIN:VEVENT
UID:demo-standup@example.test
DTSTAMP:20261117T120000Z
DTSTART;TZID=Europe/Prague:20261201T100000
DTEND;TZID=Europe/Prague:20261201T103000
SUMMARY:Demo standup
LOCATION:Office
URL:https://example.test/meeting
RRULE:FREQ=DAILY;COUNT=3
END:VEVENT
BEGIN:VEVENT
UID:demo-offsite@example.test
DTSTAMP:20261117T120000Z
DTSTART;VALUE=DATE:20261204
DTEND;VALUE=DATE:20261205
SUMMARY:Demo offsite
END:VEVENT
END:VCALENDAR
```

1. Settings → **Work calendar imports** → create Source `Demo work`.
2. Select the file. Set Scope start **2026-12-01**, Scope end **2026-12-06**, timezone **Europe/Prague**. End is exclusive.
3. Leave **complete refresh** off. Click **Preview Events**, inspect the parsed entries, then **Apply import**.
4. Inspect December 1–4 in Day view.

**Look for:** three 10:00–10:30 meetings and one all-day Event on December 4 only. Fixed Events block planning. Importing the exact file again into the **same Source** should not duplicate them.

## Try each option and refresh behavior

- **Source:** reuse `Demo work` for revisions. A new Source is a separate dataset, not a refresh of the old one.
- **Scope start/end:** narrow the preview to December 2–3 (end December 4). Only occurrences in that range should be considered.
- **Timezone:** supplies the interpretation for floating times without `Z` or `TZID`. For the explicitly zoned meeting above, changing the fallback must not change its instant.
- **Update:** change the meeting summary and reimport with the same UID. Existing linked Events should update, not multiply.
- **Local override:** edit one imported Event's time locally; change its source time and reimport. The local time override should survive.
- **Partial refresh (off):** remove the offsite VEVENT block and reimport the original scope. The previously imported offsite should remain.
- **Complete refresh (on):** reimport that reduced file with the **original exact Source and scope** and complete refresh on. The missing offsite should be removed; Events outside that declared scope remain.
- **Cancellation:** use a copy with `STATUS:CANCELLED` inside an existing VEVENT. Reimport and check cancellation removes its matching reservation. For one recurring occurrence, use an exported cancellation with `RECURRENCE-ID`; the rest of the series remains.
- **AI permission:** new Sources default off. Toggle “Allow external AI processing for this Source” only when intended. This enables eligible chat context; importing itself does not call AI.
- **Bad file:** break a date or VEVENT structure and preview. Look for errors and blocked Apply; previously imported Events must survive. Files must be below 500 KB.

**Location versus travel:** importing `LOCATION:Office` preserves source metadata. Confirm attendance/location requirements in the Event editor before expecting a Journey; an imported address alone is not a route estimate.
