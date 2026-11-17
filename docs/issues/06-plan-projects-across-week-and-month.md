## What to build

Let users group Tasks under Projects and Milestones, reserve recurring work time for concrete Project Tasks, and inspect the plan in Week and Month views. Show Events, deadlines, and workload at the appropriate level, with navigation into the Day plan for taking action.

## Acceptance criteria

- [ ] A user can create Projects and Milestones and associate existing or new Tasks with them.
- [ ] A Project can reserve weekly time and cadence for eligible ready Tasks.
- [ ] Week view shows all seven days and supports a day agenda; Month view shows Events, deadlines, and workload.
- [ ] Views distinguish scheduled Tasks, Events, unscheduled work, and deadlines without relying on color alone.
- [ ] The selected calendar UI library is compatible with the existing stack and supports keyboard and touch alternatives to drag interactions.

## Blocked by

- 01-schedule-manual-tasks-in-day.md
- 03-automatically-plan-and-stabilize-day.md

## Implementation decisions (#222)

- Reuse the existing React DayPicker 9 calendar through `@gc/ui` for Month selection, together with the existing React/TanStack/Vite stack. Its existing keyboard focus/navigation behavior and touch-selectable buttons remain available. Week uses the existing Day timeline layout utilities across seven scrollable columns.
- Selecting a date or a Week item opens its agenda. **Open Day plan** keeps the selected date and exposes the existing date/time movement and duration controls; dragging is optional.
- Weekly Project time targets reserve concrete active Tasks with an Effort estimate and automatic scheduling enabled. Completed work still credits its calendar week. Targets and preferred weekdays are editable; an empty weekday selection permits any day. A target is intended time, not a maximum effort limit.
- Preserve existing placements, Pins, active Sessions, Events, and Protected periods. Show unmet Project targets and ask for the next concrete Task rather than creating placeholder work. Project time targets do not introduce leisure borrowing or recovery behavior.
- Task Sessions use solid borders, Events use dashed borders, and deadlines, preferred finish dates, unscheduled work, and workload have explicit text labels. Task-panel Project filtering does not hide calendar commitments.
- Projects use a full workspace with a project list and an always-visible compact settings form for the selected Project. Preferred weekdays use selectable chips in the configured calendar order. New Project opens a drawer. Milestones group active Tasks beneath named checkpoints; Tasks may also belong directly to the Project. Task creation within a group preselects its Project and Milestone.
- Day, Week, Month, and Projects have separate nested routes under `/dashboard`. The selected calendar date is stored in the `date` search parameter and carried between views. The Dashboard index redirects to Day, retaining locale and date.
- Show one allocation status for the selected calendar week: allocated time and any remaining time to plan. Weekly target and preferred days appear once in the editable form. Count recorded work from completed Tasks, and keep time allocation distinct from Task completion.
- Day, Week, Month, Projects, and Settings share the top navigation bar as text links. Calendar views share one date picker and a toolbar labelled **+ Task**, **+ Event**, and **+ Project**. Previous/next moves by one day, week, or month according to the current calendar view; creation uses the selected date and planning timezone.
- Project creation uses the same shared Drawer footer as other entity forms: Cancel on the left and Save on the right. Inline Milestone actions use the same dismiss-before-save ordering, and Event/Session saves show the shared pending/error feedback.
