# #232 — Explain Priority and learn corrections

[Issue](https://github.com/cajkavlada/GoalCue/issues/232) · [All guides](README.md)

**Benefit:** distinguish “important” from “due soon,” see why a suggestion exists, and keep your manual choice authoritative.

## Try: importance without urgency

1. Create Project `Demo health`, importance **high**, and Milestone `Demo checkup`, importance **critical**.
2. Create `Demo book checkup` in that Project/Milestone with no deadline. An unlinked new Task defaults to **normal**; automatic suggestions can change it once linked.
3. Open its Task editor's Priority section. Inspect current Priority, suggestion and contributing signals.
4. Enable **Automatic Priority** and submit that section.

**Look for:** Project high and Milestone critical are shown as signals; suggested Priority is critical. With automatic enabled, the current Priority follows that suggestion. A far-away or absent deadline does not make an important Task unimportant.

## Try each option

- **Low / normal / high / critical:** manually choose each and submit the Priority section. Choosing a value switches automatic off. Example meanings: optional tidying / ordinary work / important preparation / essential commitment.
- **Manual authority:** set low, then raise Project/Milestone importance or replan. Current Priority must stay low even if the displayed suggestion is critical.
- **Automatic again:** explicitly turn automatic on and submit. It should adopt the structured suggestion again.
- **No signals:** create a Task with no Project/Milestone/correction. Suggestion should be normal.
- **Project only:** link to Demo health without a Milestone. Suggestion should be high.
- **Milestone precedence:** make the Milestone low while Project is high. Current implementation uses the Milestone signal after the Project signal, so the suggestion is low; it does not simply choose the highest importance.
- **Urgency:** give a normal-Priority Task a firm deadline soon and significant remaining effort. Inspect deadline/remaining-work explanation and planning risk. Its Priority should not become critical merely because time is short.
- **Skip/delay:** skip a Session or move its finish date. Reopen Priority: skipping/delay alone must not lower it.

## Try: teach a correction

1. On Demo book checkup, choose **high**, then click **Correct and remember for this Task type and Project/Milestone**. This also sets a manual Priority.
2. Inspect **Relevant learned preferences** and the suggestion's correction signal.
3. Create another Task with the **same Task type, Project and Milestone**. Inspect its suggestion; enable automatic to apply it.
4. Create a Task with a different Task type or Project. It should not inherit that scoped correction.
5. Remove the correction from Relevant learned preferences. The suggestion should fall back to Project/Milestone/default signals. A manually set Priority remains manual until you re-enable automatic.

**Look for:** the latest matching structured correction wins, even over Milestone importance. Merely selecting a manual Priority does not teach a preference; use the correction action for that.

## What “learning” currently means

This is deterministic learning from explicit corrections scoped to **Task type + Project + Milestone**, with Project/Milestone importance as other signals. It is not an AI model examining your full history. Free-text chat preferences do not become structured Priority corrections automatically. This feature can be tested without an AI connection.
