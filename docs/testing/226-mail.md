# #226 — Mail Tasks and bounded review routines

[Issue](https://github.com/cajkavlada/GoalCue/issues/226) · [All guides](README.md)

**Benefit:** turn a message into tracked work, and review a small batch without making “empty the inbox” your completion rule.

## Try without connecting Gmail

1. Open Settings → Personal mail. Create an **Inbox review** routine, select Task type and Priority class, batch size **5**.
2. Inspect its Task: default effort **15 minutes**, recurring on weekdays. Create a **Spam cleanup** routine too: default **10 minutes weekly**.
3. Choose **Review manually**, review mail in your mail app, then **Confirm review complete** in GoalCue.

**Look for:** completion is your explicit decision. Gmail access and inbox zero are unnecessary. Edit effort, Priority, recurrence cadence and end conditions in the normal Task editor to suit your routine.

## Try: message → two linked actions

1. Connect a **personal** Gmail account using the acknowledgement checkbox. Add a disposable label containing a few test messages; select that label as the Source.
2. Refresh the label and open a message such as “Please review the proposal and confirm your price.”
3. Create a **New independent action**, title `Demo review proposal`, kind **Action Task**; select Task type/Priority class and save.
4. Reopen that message and create another independent action `Demo reply with price`, kind **Reply Task**.
5. Open both Tasks and follow their Gmail links.

**Look for:** two distinct Tasks linked to one message. No message is sent, deleted, archived or marked read in Gmail by these actions.

## Try each permission and action option

- **Message bodies off/on:** compare metadata-only access with message text. Bodies on reveals optional retained excerpt, reply draft and missing-input fields.
- **Thread context:** enable it for a conversation with two messages under the selected label. Compare the available context; it is bounded to that label.
- **Text attachments:** enable and open a message with a small `.txt` attachment. Text attachments up to 100 KB each are supported; this is not general PDF/image reading.
- **Allow external AI processing:** grants permission for eligible retained Source data. This mail form itself calls no AI and does not automatically extract actions or write replies.
- **Exclude Source:** enable and save; processing should become unavailable. Revoke body/AI permissions and check retained excerpts/drafts are cleared as applicable.
- **Excerpt / reply draft / missing facts:** enter a short excerpt, `I can offer [price]`, and missing fact `price`. Open the Reply Task and check the saved draft flags the needed input. You still send it in Gmail yourself.
- **Related update:** on a later message in the same thread, select the existing action instead of “New independent action.” Save a revised title and verify the same Task/progress remains.
- **New request:** choose a new independent action. It should create separate work, even within the same thread.

## Try: bounded batch and disconnection

1. With batch size 5 and more than five labelled messages, **Start / resume review batch**. It contains at most five messages.
2. Add another labelled message, then resume. The running batch stays fixed; new mail waits for a later batch. **Mark reviewed** advances GoalCue's count only.
3. **Confirm review complete** even if Gmail still contains messages. Verify the current routine Occurrence completes, not every future Occurrence.
4. Disconnect the demo Source. Choose **Keep routines as manual reminders**, then repeat on another demo Source with **Stop future review Occurrences**.

**Look for:** retained excerpts/reply drafts clear on disconnection; kept routines work manually; stopped routines cease future reviews. Account authorization is browser-session based, so reconnect when needed. If Gmail is unconfigured, the manual example still works.
