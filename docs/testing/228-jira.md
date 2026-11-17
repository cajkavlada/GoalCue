# #228 — Jira CSV and board balancing

[Issue](https://github.com/cajkavlada/GoalCue/issues/228) · [All guides](README.md)

**Benefit:** import work from several boards, preserve local planning, and plan effort without treating story points as hours.

## Try: four issues, three estimate rules

Save as `demo-jira.csv`:

```csv
Key,Summary,Description,Status,Priority,Assignee,Due,Remaining,Original,Points,Project,Parent,Boards,Sprint,SprintEnd,SprintFirm,Link
DEMO-1,Demo login,Fix login,Open,High,Me,,60,240,5,Demo product,EPIC-1,Frontend;Platform,Sprint 1,2026-12-04,false,https://example.test/DEMO-1
DEMO-2,Demo API,Build endpoint,Open,Normal,Me,,,120,3,Demo product,EPIC-1,Platform,Sprint 1,2026-12-04,false,https://example.test/DEMO-2
DEMO-3,Demo report,Write report,Open,Low,Me,,,,8,Demo product,,Reporting,,,,https://example.test/DEMO-3
DEMO-4,Demo blocked,Waiting for access,Blocked,Critical,Me,2026-12-03,30,,1,Demo product,,Platform,Sprint 1,2026-12-04,true,https://example.test/DEMO-4
```

1. Settings → **Import Jira CSV**. Enter instance `example.test`, Job/dataset `Demo job`, fallback **45 minutes**; choose a Task type and Priority class.
2. Select the file. Map every field to its corresponding header. Required: **Issue identity → Key**, **Summary → Summary**. Leave a field **Not mapped** to deliberately ignore it.
3. Map Open → **Ready**, Blocked → **Paused**. Map Low/Normal/High/Critical to their matching Priority values. Import.
4. Open the imported Tasks and inspect their Jira details.

**Look for:** DEMO-1 effort **60** (remaining wins); DEMO-2 **60** (half original 120); DEMO-3 **45** (fallback, despite 8 points); DEMO-4 paused with a firm December 3 deadline. A row not supplied with a finish date should have no invented date.

## Every mapping, in practical terms

- **Identity / link:** Key prevents duplicates; Link opens the original issue.
- **Summary / description:** Task title and explanatory text. Quoted CSV is supported for commas/newlines.
- **Status:** Ready may plan; Paused waits; Done represents completed work. Try mapping Open to Done on a disposable row and inspect the result.
- **Priority:** low, normal, high or critical importance; Priority class is the separately selected existing app classification.
- **Assignee:** retained source context; do not assume the import automatically filters to “Me.”
- **Due date:** a firm finish. Dates use `YYYY-MM-DD`, interpreted at end of day UTC.
- **Remaining / original / story points:** minutes first; otherwise 50% of original; otherwise configured fallback. Points stay separate.
- **Project / parent:** preserve project and parent identity/grouping. Inspect the resulting Task linkage; use the Project editor for time targets.
- **Boards:** semicolon-separated memberships; DEMO-1 belongs to two boards but is still one Task. Its **Balancing Board** chooses which board receives planning credit.
- **Sprint / sprint end / firm flag:** named iteration and known end. `false` makes sprint end preferred; `true` makes it firm. An explicit Due date takes precedence. Missing future sprint dates are not guessed.

## Try: reimport and balance

1. Record progress and manually change DEMO-1's Priority or planning fields. Change source description/remaining time, select the **saved mapping** for the same instance/Job and import again.
2. Verify one Task per Key, updated source data, preserved local progress/overrides. Import a file missing DEMO-3: it should remain (this is not a delete-missing import).
3. For a balancing comparison, use Ready Tasks with equal Priority and no pressing deadlines, clear enough future Availability, and run automatic planning. Inspect Sessions across Frontend/Platform/Reporting. Expect attention across eligible boards, not necessarily identical minutes.
4. Change DEMO-1's Balancing Board between its two memberships. It remains one piece of work, credited once. Give a Task a tight firm deadline; deadline risk may outweigh variety.
5. Set a Project weekly time target with eligible Tasks and rerun. Inspect Project allocation alongside board variety; a time target cannot schedule paused or otherwise ineligible work.

**Validation examples:** use `tomorrow` as Due, negative Remaining, or conflicting rows with the same Key. Check rejected-row reasons. Valid rows may still import. Limits: 500 rows and below 500 KB. There is no live Jira connection, write-back or external AI processing in this importer.
