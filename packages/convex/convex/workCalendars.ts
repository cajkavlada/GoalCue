import { ConvexError, v } from "convex/values";

import { authedMutation, authedQuery } from "./utils/authedFunctions";
import { autoPlan } from "./utils/autoPlan";
import { parseWorkCalendar } from "./utils/workCalendar";

const importArgs = {
  text: v.string(),
  from: v.string(),
  to: v.string(),
  timezone: v.string(),
};

export const list = authedQuery({
  args: {},
  handler: (ctx) =>
    ctx.db
      .query("workCalendarSources")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect(),
});

export const preview = authedMutation({
  args: importArgs,
  rateLimit: { name: "previewWorkCalendar" },
  handler: (_ctx, args) =>
    parseWorkCalendar(args.text, args.from, args.to, args.timezone),
});

export const saveSource = authedMutation({
  args: {
    sourceId: v.optional(v.id("workCalendarSources")),
    name: v.string(),
    aiEnabled: v.boolean(),
  },
  handler: async (ctx, { sourceId, name, aiEnabled }) => {
    if (!name.trim()) throw new ConvexError("Enter a Source name");
    if (sourceId) {
      const source = await ctx.db.get(sourceId);
      if (!source || source.userId !== ctx.userId)
        throw new ConvexError("Source not found");
      await ctx.db.patch(sourceId, { name: name.trim(), aiEnabled });
      return sourceId;
    }
    return ctx.db.insert("workCalendarSources", {
      userId: ctx.userId,
      name: name.trim(),
      aiEnabled,
    });
  },
});

export const applyImport = authedMutation({
  args: {
    ...importArgs,
    sourceId: v.id("workCalendarSources"),
    fullRefresh: v.boolean(),
  },
  rateLimit: { name: "importWorkCalendar" },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source || source.userId !== ctx.userId)
      throw new ConvexError("Source not found");
    const parsed = parseWorkCalendar(
      args.text,
      args.from,
      args.to,
      args.timezone
    );
    if (parsed.errors.length)
      return { ...parsed, imported: 0, changed: 0, removed: 0 };
    const scope = JSON.stringify([args.from, args.to, args.timezone]);
    const existing = (
      await ctx.db
        .query("fixedEvents")
        .withIndex("by_user_start", (q) => q.eq("userId", ctx.userId))
        .collect()
    ).filter((e) => e.workSourceId === args.sourceId);
    let imported = 0,
      changed = 0,
      removed = 0;
    for (const { key, cancelled, ...values } of parsed.events) {
      const previous = existing.find((e) => e.sourceKey === key);
      const snapshot = { ...values, attention: "focused" as const };
      if (previous) {
        const before = JSON.parse(previous.sourceSnapshot!);
        const patch: Record<string, unknown> = {};
        const overrides = new Set(previous.sourceOverrides ?? []);
        const timeFields = [
          "startAt",
          "endAt",
          "timezone",
          "allDayStart",
          "allDayEnd",
        ] as const;
        if (timeFields.some((field) => previous[field] !== before[field]))
          timeFields.forEach((field) => overrides.add(field));
        for (const field of [
          "title",
          "startAt",
          "endAt",
          "timezone",
          "attention",
          "allDayStart",
          "allDayEnd",
          "location",
          "meetingLink",
          "sourceLink",
          "recurrence",
        ] as const) {
          if (previous[field] !== before[field]) overrides.add(field);
          if (!overrides.has(field))
            patch[field] = snapshot[field as keyof typeof snapshot];
        }
        const deletedAt = cancelled
          ? Date.now()
          : previous.sourceRemoved && !previous.locallyDeleted
            ? undefined
            : previous.deletedAt;
        if (
          previous.sourceSnapshot !== JSON.stringify(snapshot) ||
          !!previous.sourceRemoved !== cancelled
        )
          changed++;
        await ctx.db.patch(previous._id, {
          ...patch,
          sourceSnapshot: JSON.stringify(snapshot),
          sourceOverrides: [...overrides],
          sourceRemoved: cancelled,
          deletedAt,
          importScope: scope,
        });
      } else if (!cancelled) {
        await ctx.db.insert("fixedEvents", {
          ...snapshot,
          userId: ctx.userId,
          workSourceId: args.sourceId,
          sourceKey: key,
          importScope: scope,
          sourceSnapshot: JSON.stringify(snapshot),
        });
        imported++;
      }
    }
    for (const event of existing) {
      const [uid, recurrenceId] = JSON.parse(event.sourceKey!);
      const cancelled = parsed.cancellations.some(
        (c) =>
          c.uid === uid && (!c.recurrenceId || c.recurrenceId === recurrenceId)
      );
      if (
        (cancelled ||
          (args.fullRefresh &&
            event.importScope === scope &&
            !parsed.events.some((e) => e.key === event.sourceKey))) &&
        !event.sourceRemoved
      ) {
        await ctx.db.patch(event._id, {
          deletedAt: Date.now(),
          sourceRemoved: true,
        });
        removed++;
      }
    }
    await ctx.db.patch(source._id, { lastSuccessAt: Date.now() });
    await autoPlan(ctx);
    return { ...parsed, imported, changed, removed };
  },
});
