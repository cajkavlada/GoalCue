# #231 — Manage planning through chat

[Issue](https://github.com/cajkavlada/GoalCue/issues/231) · [All guides](README.md)

**Benefit:** describe one planning change in ordinary language, then verify the same record in the normal UI.

**Setup:** complete [#230 activation](230-ai.md). Expand **Planning chat** at the bottom of the dashboard. Use uniquely named demo records and explicit future dates. If GoalCue needs your actual Task type or Priority class name, supply it rather than expecting an invented classification.

## First example: change and undo

1. Create `Demo chat reading` in the Task form.
2. Send: **“Set the Priority of Demo chat reading to high.”**
3. Look for **Applied**, then open its Task editor: Priority should be high and manual.
4. Click **Undo action** within 15 minutes. Reopen the Task: its former value should return.

**Look for on every example:** inspect the resulting object, not just the assistant's sentence. A clarification should change nothing; a pending preview should change nothing until **Confirm changes**.

## Try one prompt per feature

Replace dates/names to match your test setup. Send one command at a time; the implementation applies at most one tool per message.

- **Create Task:** “Create Demo chat walk, 30 minutes of effort, normal Priority, using Task type [name] and Priority class [name].” Check the new Task; supply any requested required fields.
- **Edit Task:** “Rename Demo chat walk to Demo evening walk.” Verify other fields remain intact.
- **Event:** “Create Demo chat call on December 1, 2026, 14:00–14:30 Europe/Prague, Online, focused.” Check fixed time and attendance.
- **Project:** “Create Project Demo launch with high importance and a weekly time target of 120 minutes.” Inspect the Project editor.
- **Milestone:** “Create Milestone Demo first draft in Demo launch with preferred finish December 4, 2026.” Check Project linkage and preferred/firm meaning.
- **Categories:** “Create activity category Demo reading.” Then request its rename; inspect the category list.
- **Recurrence:** “Make Demo chat reading recur weekly on Tuesday in Europe/Prague, starting December 1, 2026 and ending December 22, 2026.” Inspect cadence and boundaries. For a later edit explicitly state “this Occurrence” or “this and future Occurrences.”
- **Progress:** “Record 10 minutes of progress on Demo chat reading.” Use a Task whose primary progress measure is time. Check a second report adds 10, rather than replacing the total. For percentage Tasks, reported percentage replaces the value.
- **Priority:** “Enable automatic Priority for Demo chat reading.” Inspect its automatic switch. A manual “set to low” should turn automatic off again.
- **Availability:** “Set my Availability on December 1, 2026 to 09:00–12:00 Europe/Prague.” Check that date; other dates and Protected periods should remain intact.
- **Schedule placement:** “Schedule 30 minutes of Demo chat reading on December 1, 2026 at 10:00 Europe/Prague.” Inspect the Session. If blocked, expect the planner's conflict, not a false success.
- **Pin:** “Pin the December 1, 2026 10:00 Session of Demo chat reading.” Verify its Pin in Day view.
- **Check-in:** after a Session ends, “Mark the [date/time] Session of Demo chat reading as not done.” Inspect its Check-in and remaining work. Do not infer completion just from elapsed time.
- **Automatic planning:** “Plan my day for December 1, 2026.” Inspect Sessions and shortfalls.

## Try clarification and confirmation

- Create two Tasks with the same title; ask to change that title. Expect a focused question/error identifying ambiguity, with no arbitrary edit. Answer with a unique title or record ID.
- Ask “Move reading to Friday” without sufficient date/Session context. Expect clarification where the interpretation changes the result.
- Ask to archive several named disposable Tasks. Inspect the exact preview before confirming; verify only the listed Tasks are affected.
- Ask for a recurring-series change without saying this Occurrence/future scope. Expect clarification.
- Ask to schedule inside a Protected period or over a Pin. Expect a conflict or an explicit-exception preview; the protection must not disappear silently.
- For a disposable mail/calendar Source, request removal with an explicit keep/remove choice. Inspect the warning and confirm only if intended. Source removal requires reconnecting through Settings; it is not a normal undoable edit.

## Try history and preference options

- **New conversation / selector:** create two conversations, switch back, and check retained messages.
- **Delete conversation:** remove a demo conversation. Its history should disappear; applied planning changes are not undone merely by deleting messages.
- **Retained preferences:** save “Prefer reading in the evening,” inspect it, then Remove. Free-text preferences inform chat; this is not a guaranteed scheduling rule or a structured Priority correction.
- **Temporary chat:** enable before sending. Reload: temporary messages should not reappear in retained history. Actions still change the plan; undo data expires after 15 minutes.
- **Failure:** disable AI or exhaust its allowance. Expect a visible error, working manual controls, and no silently repeated action.

**Scope limits:** excluded/disallowed source records should be unavailable to chat. Work ICS needs explicit source AI permission; personal calendar records are currently excluded. Unsupported requests should direct you to the UI instead of claiming success.
