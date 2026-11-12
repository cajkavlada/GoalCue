# GoalCue Planning

GoalCue plans work and personal activities across time. This context defines the concepts used to schedule commitments and track progress toward longer outcomes.

## Language

**Task**:
A flexible work item that can be scheduled and tracked. Tasks may be created directly or derived from an imported issue or email, with a link to the source.
_Avoid_: Todo, to-do

**Event**:
A fixed-time calendar commitment, which may include a location. Events can be entered directly or imported from a calendar.
_Avoid_: Appointment, calendar task

**Project**:
A longer outcome represented by a group of milestones and tasks.
_Avoid_: Goal

**Milestone**:
An intermediate checkpoint in a project.

**Source link**:
A reference connecting an imported task or event to the item in its originating service.

**Availability**:
Time windows in which Tasks may be planned, described by a weekly template and date-specific overrides. Work and personal windows may be shared or separated.

**Protected period**:
A period reserved against automatic Task placement, such as sleep or explicitly protected leisure time.

**Focused Event**:
An Event requiring full attention, incompatible with simultaneous Tasks.

**Background Event**:
An Event that permits compatible simultaneous activities. Multiple Background Events may overlap, with compatibility assessed across all concurrent commitments.

**Free-time reserve**:
Unscheduled time retained within availability, with a preferred amount and a protected minimum. The portion above the minimum can yield to pressing Tasks.

**Leisure Task**:
A flexible Task representing a leisure activity, distinct from an explicitly protected period.

**Source**:
A calendar, mail folder or label, or manually imported dataset from which GoalCue derives planning records. Source-level permissions govern access and AI processing.

**Source excerpt**:
Relevant source content retained to explain a derived Task or Event, rather than a complete copy of the original item.

**Reply Task**:
A Task to reply to a message through its Source link. Its description may contain a recommended reply with missing manual inputs clearly highlighted.

**Learned preference**:
A planning preference derived from previous Tasks, Events, or manual corrections, attributable to its contributing sources.
