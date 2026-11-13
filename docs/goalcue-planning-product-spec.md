# GoalCue Planning Product Specification

**Status:** Draft assembled from the completed Wayfinder decisions on 13 November 2026. This document specifies product behavior; it does not approve or describe an implementation plan in code.

## 1. Product outcome

GoalCue is a personal planner for work and personal life. It organizes fixed calendar commitments, flexible Tasks, and longer Projects, then builds and continuously maintains a realistic schedule across the day, week, and month.

The planner acts automatically. It places and reschedules flexible work without asking for approval, while keeping changes visible, reversible, and easy to correct. Fixed commitments and protected boundaries remain respected. When the day cannot fit everything, GoalCue makes the trade-offs visible and protects leisure and family time through explicit recovery rules.

The product evolves in stages. Manual planning remains usable when an external Source or AI feature is unavailable.

## 2. Product principles

- **Day first:** the day plan is the primary place to act; week and month views support longer-range planning.
- **Automatic and editable:** GoalCue schedules and reschedules Tasks itself. Users can drag, move, pin, reprioritize, correct, or undo.
- **Stable plans:** small optimization gains do not justify reshuffling. GoalCue moves the fewest Sessions necessary and explains automatic changes.
- **Clear boundaries:** Events, travel, sleep, protected periods, and user permissions constrain automation. The application, not model output, enforces these rules.
- **Leisure is planned work:** reading, exercise, music, and family activities can be recurring, priority-bearing Tasks. Borrowed leisure creates a bounded recovery opportunity, not an accumulating debt.
- **Sources stay under user control:** personal sources are selected and read-only. Work accounts are never connected directly; work data enters through user-selected files.
- **Progress is explicit:** passing scheduled time does not mean a Task was completed. Unknown check-ins remain unknown.

## 3. Domain model

Use the vocabulary in [CONTEXT.md](../CONTEXT.md). The core concepts are:

- **Task:** flexible work that can be scheduled and tracked. A Task may be manual, imported from Jira, or derived from an email, and can link to its Source.
- **Event:** a fixed-time calendar commitment. Events may be focused or allow compatible background activity, and may have a physical or online location.
- **Project:** a longer outcome grouping Milestones and concrete Tasks. GoalCue does not introduce a separate Goal entity.
- **Milestone:** an intermediate Project checkpoint.
- **Session:** a scheduled portion of a Task or recurring Occurrence. One Task or Occurrence can span Sessions and days.
- **Occurrence:** one instance of recurring work, with independent progress and completion state.
- **Source:** a selected calendar, mail folder/label, or imported dataset from which GoalCue derives records. Source permissions govern access and AI processing.
- **Activity category:** an editable classification such as work, personal, sport, music, reading, or family. It is distinct from Source and Project.

Priority and deadline Urgency are separate. Firm deadlines create overdue work if missed; preferred finish dates guide placement and may slip. A Pin prevents automatic movement of a Session but does not override planning boundaries.

## 4. Availability and schedule constraints

### 4.1 Availability

Availability is defined by a weekly template plus date-specific additions, removals, replacements, and closed days. Overrides take precedence. Initial setup should be minimal; learned changes to recurring availability require user acceptance.

Work and personal Tasks share availability by default. Users can optionally require work Tasks to use work windows and personal Tasks to use personal windows. Sleep, explicitly protected periods, focused Events, and required travel constrain automatic placement. A user may explicitly override a single placement after seeing a conflict; that override does not change recurring rules.

### 4.2 Events and overlaps

Events are either:

- **Focused:** incompatible with simultaneous Tasks.
- **Background:** may overlap compatible Tasks and other Background Events.

AI may classify Event attention requirements using permitted details and prior corrections. Users can edit classifications; explicit corrections take precedence. If compatibility is uncertain, GoalCue does not add another Task automatically. Multiple Background Events may overlap; compatibility checks become stricter as concurrent commitments increase. All-day Events remain date representations and do not imply a particular attention requirement.

### 4.3 Travel and locations

Events may be physical, online, hybrid, or unknown. A hybrid Event records the intended attendance mode. An online link alone does not imply travel. Tasks may have location requirements; absent a clear requirement, home is a planning default, not a hard constraint.

GoalCue may infer locations and Journeys from permitted details, familiar places, and corrections. Ambiguous addresses remain unresolved. Travel can be planned from prior known physical locations and saved places, with assumptions shown when whereabouts are uncertain. Continuous location tracking is not required.

External routing requires separate permission. Routing requests contain only locations and departure/arrival inputs, not Event titles, descriptions, or attendees. Without routing permission, users can enter manual travel durations.

Keep route time, travel margin, arrival/preparation, and post-Event wrap-up separate. Initial defaults are a configurable 20% travel margin, a 10-minute arrival buffer for physical Events, and no wrap-up buffer. Uncertain travel is never silently treated as zero or confirmed feasible. Impossible journeys preserve fixed Event times and show the shortfall with options such as remote attendance, a different mode, or a manual Event change.

## 5. Task effort, progress, recurrence, and check-ins

### 5.1 Effort and Sessions

Manual Effort estimates are optional. AI may estimate from similar Tasks and past results; when it cannot, it uses a visible default. Estimates are editable.

GoalCue automatically splits larger Tasks into Sessions. The initial preferred Session length is 45 minutes, with a 15-minute minimum and 90-minute maximum; short Tasks and final remainders may be shorter. Users can set Task-specific preferences, mark Tasks indivisible, set optional daily effort limits, and require spacing between Sessions. Multiple Sessions of one Task may occur in a day when its constraints permit.

Time spent is recorded separately from output progress. Estimates can change from results and corrections, but an estimate change alone does not justify moving unaffected Sessions.

### 5.2 Progress and completion

Each Task has one primary Progress measure: done/not done, time, percentage, or a quantity such as pages or kilometres. Time spent is also tracked separately. Time or quantity updates add to existing progress; percentage or remaining-effort updates replace the previous value. Corrections are supported.

Recorded progress reaching an explicit measurable target completes the Task or Occurrence, with undo. Reaching an Effort estimate alone never completes work. A scheduled Session passing without confirmation never counts as completed.

### 5.3 Recurrence

Support fixed schedules, frequency targets, total-volume targets, and completion-based intervals. Each Occurrence has its own progress and completion state and may span Sessions or days.

Examples:

- Three workouts per week creates three distinct Occurrences, each optionally with its own time or distance target.
- A 150-minute weekly exercise target accumulates across Sessions.
- Completion-based recurrence starts its next interval from actual completion.

Calendar weeks default to Monday through Sunday in the planning timezone; week start is configurable. Fixed recurrences follow local time through daylight-saving changes.

Fixed-schedule Occurrences expire at the end of their period by default. Frequency targets create no automatic debt in the next period. Users may opt into carry-forward-until-done; unfinished Occurrences and their progress remain visible alongside new ones. Completed history and partial results are preserved. Series edits apply to this and future Occurrences by default, with an occurrence-only option.

### 5.4 Check-ins

At Session end, GoalCue offers a nonblocking in-app card and optional device notification unless the outcome is already resolved. Users can disable prompts per Task or use a daily-review mode. Notifications respect quiet hours and focused Events; delayed check-ins can be combined.

Actions are **Finished**, **Made progress**, **Didn't do it**, **Still working**, and **Ask later**. Partial progress accepts the Task's measure, optional time spent, and optional remaining effort. Early progress is never double-counted. Still working offers 15 minutes, 30 minutes, or a custom extension; conflicts offer a shorter feasible extension or stopping and planning the remainder.

Unanswered check-ins remain **unknown**, never inferred as success or failure. GoalCue preserves future Sessions and does not create a duplicate replacement before a response. Daily review groups reports by Task while identifying individual Sessions; combined reports count selected Sessions once. Users can edit or undo reports. A miss alone never lowers Priority. Ordinary missed Tasks default to rescheduling; recurring work also offers skip under its recurrence rules.

## 6. Priority and automatic replanning

### 6.1 Priority and Urgency

Priority is low, normal, high, or critical. Initial Priority is normal. AI may assign or revise Priority based on Task content, Project/Milestone importance, explicit instructions, and prior corrections. Manual Task Priority wins until automation is re-enabled for that Task. A Task may differ from its Project or Milestone context.

Learn primarily from explicit Priority changes, deliberate choices between Tasks, and stated preferences. Skips and delays are weak signals; alone they never lower Priority. A waiting Task gradually gains scheduling preference without rewriting Priority or automatically displacing urgent work.

Urgency is based on remaining effort and compatible availability before a deadline, including an initial configurable 20% safety margin. A low-Priority Task may therefore become urgent. Firm deadlines drive Urgency and conflict warnings. Preferred finish dates guide placement but may slip. GoalCue may infer clearly supported dates from permitted Sources but leaves ambiguous dates unset. It never silently changes a deadline.

### 6.2 Replanning triggers and stability

Replan when the current plan becomes invalid or when high-priority/deadline work no longer fits. Ordinary new Tasks use available gaps. Small optimization gains do not justify reshuffling. A better board balance alone does not trigger movement. A deadline extension alone does not redistribute existing Sessions.

Keep the plan stable by:

- Changing the fewest Sessions necessary and preferring smaller shifts.
- Preserving today's plan where possible and expanding into later days only as needed.
- Preserving Pins and active Sessions by default. Interrupting an active Session requires a user choice when urgent work conflicts.
- Showing unavoidable shortfalls and affected Tasks without changing deadlines or marking unfinished work complete.
- Providing a concise reason and undo for automatic changes; treating a correction as a strong preference against repeating that change.

If a Pin conflicts with a changed Event or Availability, keep the pinned placement, show the conflict, and ask the user to resolve it. A Pin never authorizes overlap with a focused Event or protected period.

### 6.3 Overload and leisure recovery

When work does not fit, use gaps first, then move lower-Priority flexible Sessions, then borrow free-time reserve above its protected minimum or displace eligible leisure Tasks. Preserve active Sessions, Pins, and hard boundaries. Genuine Firm-deadline risk may temporarily borrow recurring Project time under the agreed bounded recovery rules; ordinary job work and soft sprint pressure may not consume it.

Track only leisure time actually removed. Manual skips create no recovery unless the user chooses to reschedule; moving a Session without reducing its duration creates no lost time. Prefer recovery through the same leisure activity. A substitute activity or unallocated free time requires user permission.

Attempt recovery within the following seven days, configurable globally and per leisure Task. The initial default is at most 60 extra minutes daily, shared by leisure and free-time recovery. Spread recovery across suitable days and respect activity Session limits. Recovery restores an opportunity; it does not require completion of the displaced activity or create accumulating debt. Unfulfilled recovery expires at the window's end with a neutral summary and preserved history. The user can extend or dismiss it.

Borrowed free-time reserve is tracked separately and restored as unallocated free time under the same window and daily cap. The reserve has a preferred amount and protected minimum, which may be zero. GoalCue never borrows below the minimum. Repeated displacement should surface a workload imbalance and offer changes to workload, deadlines, or protected leisure.

### 6.4 Jira-board allocation and Projects

For imported work across several Jira boards, allocate eligible capacity using remaining effort and deadline pressure, not equal hours or Task counts. Include each eligible board daily when meaningful Sessions fit; when capacity is too small, rotate attention across days. Do not drain one board before starting another merely because it has more Tasks.

Sprint end dates are Preferred finish dates, not Firm deadlines. Shared sprint identity across boards shares one date. Unfinished work may overflow visibly without becoming overdue solely because the sprint ended. Firm-deadline risk may override daily variety using the same safety-margin rule; soft sprint pressure alone cannot.

Projects may have an editable weekly time target and preferred cadence. Schedule concrete, ready Tasks belonging to the Project. A Project does not require a total Effort estimate to reserve recurring time. When there are no actionable Tasks, ask the user to choose or break down the next piece; do not create generic placeholder work.

One Jira issue appearing on several boards remains one Task under stable source identity. Give it one editable balancing board and credit its planned work once while retaining visibility of other board memberships. Board membership and Project membership coexist without duplicating work.

## 7. Schedule interface

### 7.1 Day, week, and month

The primary desktop view is a central day timeline with visible gaps, a collapsible Task panel, selection details, and collapsible chat. Background Events have a separate compact lane with title and time range; multiple overlaps remain legible. Location stays appear as subtle location bands. Focused Events and Task Sessions have clear blocks. Travel is compact and linked to commitments; buffers remain distinguishable. Leisure is as readable as work and free time remains visibly open. Labels and shapes supplement colour.

The week view uses the same daily timeline across seven desktop columns, with horizontal scrolling where needed on mobile and an optional agenda. Selecting a day opens its full view. The month view shows named Events/items, deadlines, workload indicators, and overflow; selecting a date opens its agenda, and opening the day reveals exact times and supports rearrangement.

Mobile is developed alongside desktop. Plan, Tasks, Review, and Chat are available through bottom navigation; selecting an item opens a details sheet. No essential action depends on hover or dragging.

### 7.2 Task panel and editing

Search and filter Tasks by Project, Source/board, Priority, Activity category, and unscheduled status. Task-list filters do not hide calendar commitments unless calendar filtering is explicitly selected.

Clicking inspects or edits an item. Users can drag a flexible Session or use **Move to** with date/time controls. Resizing changes planned duration, not completion or progress. Details expose Priority and Pins. Conflicts appear before explicit manual overrides. Category colours are the default; Source labels remain visible and colour-by-Source is optional. Category names and colours are customizable.

### 7.3 Implementation boundary

Use existing shadcn components where suitable and retain the project's visual foundations. Calendar rendering library selection remains an implementation decision; neither FullCalendar nor a custom renderer is selected by this spec.

## 8. Data Sources and integrations

### 8.1 Personal calendar

The first connected Source is read-only Google Calendar, limited to calendars the user selects. Offer busy-times-only access. Import stable Event identity, title, start/end, timezone, recurrence and exceptions, cancellation status, location, meeting link, and Source link. Preserve all-day dates without inventing times. Changes and cancellations update records without duplicates. Background refresh targets updates within five minutes while connected, with manual refresh and visible last-success, stale, and failure status.

AI may classify Event focus/background and compatible activity, learning from editable corrections. Without AI or sufficient context, classification remains visibly uncertain rather than assuming overlap is safe.

### 8.2 Personal mail

Read-only Gmail access applies to selected accounts, folders, and labels. Message bodies and thread context may be processed; attachment processing is separately enabled. One message may yield multiple actionable Tasks or Reply Tasks, each linked to its Source. Later messages update clearly related actions; a genuinely new request creates a new Task. Replying or archiving alone does not complete an action Task.

Where AI processing is permitted, a Reply Task may contain a recommended reply with missing facts highlighted as `[INPUT NEEDED: ...]`. GoalCue never invents facts or commitments. The user reviews and sends the reply in their mail app. When AI is excluded, a Reply Task can still be created without suggested reply text.

Recurring inbox review and spam cleanup are separate Tasks with selected Sources/labels, cadence, Effort estimate, and Priority. Editable defaults are weekday inbox review for 15 minutes and weekly spam cleanup for 10 minutes, both normal Priority with flexible placement and no Firm deadline. Each Occurrence reviews a bounded batch selected when started; new messages wait for the next review unless included by the user. Inbox zero is optional, never a default completion condition. Mailbox access remains read-only: GoalCue does not send, mark read, archive, delete, or change labels.

If a Source is unavailable, show stale/unavailable status rather than an empty mailbox or completion. Users can perform the routine manually and confirm it. Removing a Source prompts the user to retarget the routine, retain it as a manual reminder, or stop future Occurrences, subject to existing Source-removal rules.

### 8.3 Work calendar and Jira imports

Work accounts are never connected directly. Work calendar data enters through ICS files; Jira data enters through CSV exports. Users can define reusable field mappings. Work files refresh only when reimported. Show imported, changed, and rejected items.

Calendar imports map stable identity, title, start/end, timezone, recurrence/exceptions, cancellation, location, meeting link, and Source. Jira maps instance and issue identity/link, summary, relevant description, status, Priority, assignee, due date, estimates, Project, parent relationships, board membership, and sprint identity/end date. Status and Priority mappings are configurable. Story points remain distinct from time estimates. Initially use 50% of a Jira time estimate as GoalCue's editable Effort starting point, preferring remaining estimate where available; never convert story points directly into hours.

Reimport updates source-controlled facts but preserves planning choices such as Sessions, Pins, progress, and explicit Priority/Effort overrides. Stable Source identity prevents duplicates; similar titles alone never trigger automatic merging. A successful complete refresh replaces contents only within its declared Import scope. Missing items leave the active plan and their future Sessions, but history, progress, and local settings remain so records can be restored if they reappear. Failures or partial retrieval preserve previous contents. A changed filter or date range defines a new scope and does not delete unrelated records.

Work planning fields may be imported while work descriptions and excerpts remain excluded from external AI until permission is explicitly enabled for that Source. Apply work restrictions to identified work content inside personal Sources too. Detection may miss work items, so allow manual correction and source exclusions.

### 8.4 Exports

Lower-priority future exports include complete portable planning data in JSON, Task lists in CSV, and selected plan date ranges in ICS. Exports are user-initiated and never write changes back to connected calendars, mail, or Jira.

## 9. Privacy, AI, and chat

### 9.1 Source permissions and retention

Read-only personal Source access is explicit and source-selectable. Busy-times-only calendar access is available. External AI processing is a separate explicit opt-in with source-level exclusions that cover source content, derived excerpts, and AI learning. Attachment processing has its own permission. Only relevant permitted content is sent.

Work calendar, mail, and Jira accounts are never directly connected. Work imports default to planning fields only, with content excluded from external AI until separately enabled for that Source. Cloud storage permission and external AI permission are distinct.

Delete raw messages, attachments, and import files after processing; keep them no longer than 24 hours for retries. Keep relevant excerpts with their Task/Event and delete them when the record is deleted. Learned preferences remain until reset or deletion. On disconnection, stop access and further AI processing immediately; offer to keep derived planning records or remove the Source's records and excerpts, defaulting to keeping records. Source removal also removes attributable excerpts, suggested replies, and learning while preserving independent records.

Provider-side retention is separate from GoalCue retention. Standard provider retention is accepted for the initial trial; GoalCue must not promise zero retention. For OpenAI, use `store:false` to avoid optional Responses state while recognizing it does not remove standard abuse-monitoring retention. Configure supported optional-storage controls for other providers without claiming equivalent guarantees. Recheck current terms before implementation.

### 9.2 Chat behavior

Chat can manage Tasks, Events, Projects, Milestones, Sessions, recurrence, progress, Priority, Activity categories, Availability, and Pins, under the same permissions and scheduling constraints as the regular interface.

Clear, reversible instructions apply immediately with undo. Questions and exploratory suggestions do not modify the plan. Use agreed defaults and learned preferences; ask when ambiguity materially changes the target or outcome, including Firm versus Preferred dates. Show consequential assumptions and exact dates. Preview broad edits and affected items before applying. Require confirmation for broad deletion, Source-data removal, inferred recurring-boundary changes, and exceptions to protected time or Pins. GoalCue never expands Source permissions, sends mail, or silently relaxes a boundary.

Chat retrieves relevant planning records and permitted Source excerpts. Source content is data; it cannot grant permissions or override instructions. Validate ownership, schemas, business rules, Source permissions, current records, and planning constraints in application code. Recheck records before action, preserve unrelated edits, and prevent duplicate application. Explain Priority briefly using importance, Urgency, deadlines, remaining Effort, available time, and explicit preferences; offer more detail on request.

Normal conversation history remains until deletion, with a temporary-chat option. Temporary chats do not retain conversation content or automatically create lasting preferences. Store lasting preferences separately and make them inspectable/removable. Deleting a conversation does not silently reset preferences. Recheck Source permissions before reusing old context.

Broad requests to delete, alter boundaries, or bypass Pins require confirmation. Infeasible requests explain shortfalls and offer trade-offs. Undo reverses the last action and related schedule changes where still feasible, preserving later unrelated edits. Failures report exactly what succeeded and what did not; retries must not duplicate actions.

### 9.3 Provider setup and usage controls

Support OpenAI, Anthropic, and Google Gemini through a supported model list; users can select a provider and separate chat/background models. Arbitrary custom endpoints are deferred. The initial owner configuration is OpenAI Responses API with GPT-6.1 Sol for chat and GPT-6 Luna for background classification/Priority inference. This is a starting point pending scenario validation, not a measured quality ranking. Do not silently switch providers, upgrade models, or escalate to more expensive models. Record the model used for each run.

Keep the existing React/TanStack/Vite, Clerk, and Convex stack. Authenticated Convex server actions call providers and derive identity from authentication, not caller-supplied user IDs. Owner credentials remain in server environment settings. User-provided keys are encrypted server-side with a separately stored encryption secret. Keys are write-only after entry, masked, replaceable/removable, and excluded from logs and model context. They are never put in browser/public Vite configuration. A failed personal key never falls back silently to owner funding.

Roles and initial trial allowances:

| Role/allowance | Initial monthly limit |
| --- | ---: |
| Owner-funded owner allowance | US$10 |
| Owner-funded invitee allowance | US$1 per invitee |
| Shared invitee pool | US$10 |
| Owner-reserved portion of owner-funded global ceiling | US$10 |
| Owner-funded global ceiling | US$20 |
| Personal-key user ceiling | US$10 per user, editable by key owner |

An invitation alone does not grant owner-funded AI; invitees use personal keys unless explicitly granted owner-funded access. Personal-key usage does not consume the owner pool but remains subject to global operational limits. Background processing is capped at 25% of each user's applicable allowance. Chat may use remaining allowance; background pauses when its share is exhausted. These are trial API-cost controls, not product pricing.

Before each call, reserve estimated maximum cost across the user's allowance, applicable funding pool, global ceiling, background share, token bounds, and concurrent reservations. Reconcile actual usage. Hold reservations for timed-out calls until cost is known. Provider billing remains authoritative and may differ; configure provider spending controls as a backstop where available, with allowance for enforcement delay.

Operational defaults are one active chat run and one background run per user; at most five provider calls per run including retries; at most two retries for temporary failures with increasing delays; 10 AI requests/minute/user; 60 globally; 10 concurrent calls globally; 16,000 input tokens and 4,000 output tokens per call including billed reasoning; and a 60-second timeout. Do not retry invalid credentials, permission failures, or exhausted budgets. These defaults are adjustable.

Show estimated monthly spend, remaining allowance, chat/background breakdown, provider/model, and warnings at 80% and exhaustion. Meter only GoalCue's own calls; disclose that other apps using the same key are outside its meter. On exhaustion, preserve manual scheduling and existing plans. Chat resumes only after user retry; do not replay unfinished chat actions. Relevant background work resumes gradually after reset, combining superseded jobs and discarding work no longer relevant or permitted.

## 10. Delivery stages

### Stage 1: Manual planner and basic chat

Manual Tasks and Events, recurring activities, Effort estimates and multi-day Sessions, Priority and deadlines, Availability and protected time, automatic scheduling/rescheduling, completion/partial-progress tracking, draggable day planning, week/month visibility, and basic chat to capture and edit Tasks and Events. The scheduling core works without AI; learned preferences and advanced interactions may follow.

### Stage 2: Personal calendar

Read-only synchronization for selected calendars, including Event changes and cancellations, busy-times-only mode, duplicate prevention, editable AI attention/overlap classification, and corrections that inform later classification.

### Stage 3: Personal mail

Read-only extraction and scheduling of actionable Tasks from selected Sources, Source links, Reply Tasks and missing-input highlights, recurring inbox/spam review Tasks, and duplicate prevention. The mailbox remains unchanged.

### Stage 4: Work imports

Independently releasable ICS work-calendar imports and Jira CSV imports. Reimports update linked records without duplicates or loss of planning edits. Show import results and respect work-data/AI permissions. No direct work-account connection.

### Stage 5: Richer chat

Conversational explanations and replanning, such as making room for a Task by Friday, using the same scheduling and privacy rules as the regular interface.

These are delivery checkpoints, not presumed standalone products. Evaluate increments with representative scenarios. Meaningful daily-planner evaluation begins when manual planning, basic chat, personal calendar, and personal mail work together. There is no required waiting period or fixed release date.

## 11. Acceptance criteria

- Work and personal Tasks, completion/partial progress, urgent work, changed Events, protected time, and stability of unaffected Sessions behave according to this spec.
- Overload and infeasible work are visible; deadlines, Pins, fixed Events, and protected boundaries are not silently changed.
- Calendar selections, changes, cancellations, busy-only access, corrections, and duplicate prevention work without changing the connected calendar.
- Mail Tasks, Reply Tasks, Source links, missing-input highlights, recurring inbox/spam routines, and duplicate prevention work without mailbox writes.
- Repeated work imports preserve planning edits, expose changed/rejected items, and do not create duplicates.
- Chat obeys Source exclusions, manual-Priority precedence, ambiguity handling, broad-edit confirmation, current-record checks, malicious source text as data, partial failures, duplicate prevention, and undo.
- Manual planning remains usable and failures remain visible when Sources or AI are unavailable.
- Data loss, unauthorized Source access or AI processing, and silent protected-boundary violations block acceptance. Known shortcomings carry forward only with explicit user acceptance and a written record.

## 12. Implementation-time decisions and out of scope

The product decisions are settled enough for review and implementation planning. The following remain implementation-time validation or are outside this destination:

- Select and validate the calendar rendering library and concrete UI components.
- Before enabling a provider/model, recheck current model availability, pricing, data controls, and account-specific settings; run scenarios for Source exclusions, manual-Priority precedence, ambiguous dates, confirmations, stale/current records, malicious source text, duplicate prevention, and undo.
- Validate quality, latency, Czech-language behavior, and tool reliability against GoalCue scenarios; no model superiority has been measured.
- Direct work-account connections are excluded due to company policy. Work files remain in scope.
- Commercial product pricing and go-to-market are outside this personal-planner spec. AI API usage-cost controls are included.

## 13. Decision traceability

- [Core planning concepts (#200)](https://github.com/cajkavlada/GoalCue/issues/200)
- [Availability and protected time (#201)](https://github.com/cajkavlada/GoalCue/issues/201)
- [Source access and privacy (#202)](https://github.com/cajkavlada/GoalCue/issues/202)
- [Delivery stages and success criteria (#203)](https://github.com/cajkavlada/GoalCue/issues/203)
- [Effort, Sessions, recurrence, and progress (#204)](https://github.com/cajkavlada/GoalCue/issues/204)
- [Priority and automatic replanning (#205)](https://github.com/cajkavlada/GoalCue/issues/205)
- [Leisure recovery (#206)](https://github.com/cajkavlada/GoalCue/issues/206)
- [Event locations and travel (#207)](https://github.com/cajkavlada/GoalCue/issues/207)
- [Import/export and field mapping (#208)](https://github.com/cajkavlada/GoalCue/issues/208)
- [Scheduled check-ins (#209)](https://github.com/cajkavlada/GoalCue/issues/209)
- [Planning interactions prototype (#210)](https://github.com/cajkavlada/GoalCue/issues/210)
- [Chat behavior (#211)](https://github.com/cajkavlada/GoalCue/issues/211)
- [Jira-board balancing (#213)](https://github.com/cajkavlada/GoalCue/issues/213)
- [Recurring inbox cleanup (#214)](https://github.com/cajkavlada/GoalCue/issues/214)
- [AI provider research (#215)](https://github.com/cajkavlada/GoalCue/issues/215)
- [AI integration and usage-cost controls (#216)](https://github.com/cajkavlada/GoalCue/issues/216)
