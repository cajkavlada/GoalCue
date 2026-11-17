# #224 — Travel around physical Events

[Issue](https://github.com/cajkavlada/GoalCue/issues/224) · [All guides](README.md)

**Benefit:** a 10:00 appointment may occupy your plan from 09:24, because travelling and arriving take time too.

## Try: clinic visit

1. In Day view, add a future fixed Event `Demo clinic`, **10:00–11:00**, attendance **Physical**, location requirement `Clinic`.
2. In its Journey fields enter origin `Home`, mode **Drive**, route **20 minutes**, travel margin **30%**, arrival **10 minutes**, wrap-up **5 minutes**. Save.
3. Expand **Travel and buffers** in Day view.

**Look for:** Journey **09:24–09:50** (20 minutes + 6-minute margin), arrival **09:50–10:00**, Event **10:00–11:00**, wrap-up **11:00–11:05**. Automatic Sessions should avoid these reservations.

## Try each attendance and Journey option

- **Online:** change the Event to Online. Its Journey and physical buffers disappear.
- **Hybrid → Online / Physical:** select each intended attendance. It should behave like that selected mode.
- **Unknown:** leave attendance unknown. Look for a warning to resolve attendance/location; unknown must not look like confirmed zero travel.
- **Location requirement:** change `Clinic` to `Office`. Route duration is cleared; enter a new estimate. This is a physical requirement, not just a decorative address.
- **Origin blank:** add an earlier Physical Event at `Home` immediately before this Event in chronological order. A blank origin can use that previous physical location. Without a known origin, expect uncertainty.
- **Walk / Cycle / Drive / Transit:** select each. Re-enter the estimated route time after changing mode. Modes do **not** calculate durations for you.
- **Route blank:** expect “unresolved” and conservative blocking, not permission to fit work into an assumed zero-minute Journey.
- **Margin 0% versus 50%:** a 20-minute route reserves 20 versus 30 minutes before arrival.
- **Arrival 0 versus 10:** preparation adds time before the Event; it does not extend the route.
- **Wrap-up 0 versus 5:** finishing adds time after the Event; it does not change its fixed end time.
- **Same origin/destination:** use `Clinic` for both. Route becomes zero; arrival/wrap-up can still reserve time. Use identical spelling.

## Try: impossible transition

Add a Physical Event at `Home` ending **09:40**, before the clinic example above.

**Look for:** the clinic Event remains at 10:00, while travel shows a **16-minute shortfall** because departure was needed at 09:24. Resolve it by manually changing an Event time, choosing remote attendance or entering a feasible route/mode. The planner should not silently move the appointment.

## Try: share a visit with an errand

Create `Demo collect prescription`: Physical Task, location requirement exactly `Clinic`, effort 10 minutes. Keep time after 11:05 free and run automatic planning.

**Look for:** a compatible Session after the visit and a shared-errand indication. Fill that gap with an existing Session and repeat: GoalCue should report missing capacity rather than move unrelated work just to combine errands.

**Current limit:** all route durations are manual. There is no external routing/permission option in this UI. A physical Task needs a compatible visit/location window; setting its address alone does not create an independent trip.
