# Try issues #223–#232

Nine example-led guides; #229 was intentionally skipped. These describe the checked-out implementation, not just the issue promises. They are manual test instructions, **not results of a completed browser test**.

Use a test account with no unrelated Tasks. Create a Task type and Priority class in Settings first if none exist. English control names are used below. Choose future dates so automatic planning has usable time; dates in file examples are fixed so the expected results are easy to compare.

1. [#223: Recover leisure and free time](223-recovery.md)
2. [#224: Travel and buffers](224-travel.md)
3. [#225: Personal calendars](225-personal-calendars.md)
4. [#226: Mail Tasks and review routines](226-mail.md)
5. [#227: Work calendar files](227-work-calendars.md)
6. [#228: Jira CSV and board balancing](228-jira.md)
7. [#230: AI providers and spending](230-ai.md)
8. [#231: Planning chat](231-chat.md)
9. [#232: Priority suggestions and corrections](232-priority.md)

Start with #224, #227, #228 and #232: these need no external account connection. #226 also has a manual routine example. #231 depends on #230 activation.

Known obstacles found while preparing these guides:

- **#223:** recovery/reserve controls exist, but the Settings submit payload omits their values. Defaults still work. The guide gives a default-based example and separate checks for the blocked options.
- **#230:** provider activation and usage reporting exist as backend functions, but there is no AI configuration/usage screen. A developer must activate a connection before chat can work.

For each example, compare the actual result with **Look for**. If it differs, record the guide/step, chosen date, actual result and expected result. Avoid treating a displayed success message alone as proof: inspect the resulting Task, Event or Session too.
