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

**Session**:
A scheduled portion of a Task or recurring Occurrence. A Task or Occurrence may span multiple Sessions across days.

**Occurrence**:
One instance of recurring work, with its own progress and completion state.

**Effort estimate**:
The expected working time needed to complete a Task or Occurrence, distinct from recorded time spent and output progress.

**Progress measure**:
The primary way completion is tracked for a Task or Occurrence: done/not done, time, percentage, or a quantity such as pages or distance.

**Priority**:
A Task's importance, expressed as low, normal, high, or critical, distinct from deadline pressure.

**Urgency**:
Deadline pressure based on remaining effort and compatible availability before the deadline, including a safety margin.

**Firm deadline**:
A required completion date whose violation makes unfinished work overdue.

**Preferred finish date**:
A desired completion date that guides placement but may slip.

**Pin**:
An explicit restriction preventing automatic movement of a Session, without granting permission to violate planning boundaries.

**Leisure displacement**:
Leisure time removed or shortened by automatic planning to accommodate urgent work, distinct from a manual skip or a move that preserves duration.

**Recovery request**:
A time-limited attempt to restore displaced leisure or borrowed free-time reserve, without creating an accumulating obligation.

**Recovery Session**:
A Session scheduled to fulfil a Recovery request through a leisure activity.
