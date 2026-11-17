import { ConvexError, v } from "convex/values";

import { calendarAccess, calendarChoice, importedEventFields } from "@gc/db";

import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  authedMutation,
  AuthedMutationCtx,
  authedQuery,
} from "./utils/authedFunctions";
import { autoPlan } from "./utils/autoPlan";
import { planningTool } from "./utils/planningTool";

export const list = authedQuery({
  args: {},
  handler: async (ctx) => ({
    grants: (
      await ctx.db
        .query("calendarGrants")
        .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
        .collect()
    )
      .filter((g) => g.disconnectedAt === undefined)
      .map(({ credentials: _credentials, ...grant }) => grant),
    sources: await ctx.db
      .query("calendarSources")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect(),
  }),
});

export const authorize = internalMutation({
  args: { userId: v.string(), state: v.string(), access: calendarAccess },
  handler: async (ctx, args) => {
    const expired = await ctx.db.query("calendarAuthorizations").collect();
    for (const row of expired)
      if (row.expiresAt < Date.now()) await ctx.db.delete(row._id);
    await ctx.db.insert("calendarAuthorizations", {
      ...args,
      expiresAt: Date.now() + 10 * 60_000,
    });
  },
});

export const consumeAuthorization = internalMutation({
  args: { state: v.string(), userId: v.string() },
  handler: async (ctx, { state, userId }) => {
    const row = await ctx.db
      .query("calendarAuthorizations")
      .withIndex("by_state", (q) => q.eq("state", state))
      .unique();
    if (
      !row ||
      row.userId !== userId ||
      row.consumed ||
      row.expiresAt < Date.now()
    )
      throw new Error("Calendar authorization expired; connect again");
    await ctx.db.patch(row._id, { consumed: true });
    return row;
  },
});

export const finishAuthorization = internalMutation({
  args: {
    authorizationId: v.id("calendarAuthorizations"),
    userId: v.string(),
    access: calendarAccess,
    email: v.string(),
    credentials: v.string(),
    calendars: v.array(calendarChoice),
  },
  handler: async (ctx, { authorizationId, ...args }) => {
    const authorization = await ctx.db.get(authorizationId);
    if (
      !authorization?.consumed ||
      authorization.expiresAt < Date.now() ||
      authorization.userId !== args.userId ||
      authorization.access !== args.access
    )
      throw new Error("Calendar authorization expired or cancelled");
    const existing = await ctx.db
      .query("calendarGrants")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    if (
      existing.some(
        (g) => g.disconnectedAt === undefined && g.email === args.email
      )
    )
      throw new Error(
        "This account is already connected; disconnect it before changing its permissions"
      );
    await ctx.db.delete(authorizationId);
    return ctx.db.insert("calendarGrants", args);
  },
});

export const select = authedMutation({
  args: { grantId: v.id("calendarGrants"), calendarIds: v.array(v.string()) },
  rateLimit: { name: "selectCalendars" },
  handler: async (ctx, { grantId, calendarIds }) => {
    const grant = await ctx.db.get(grantId);
    if (
      !grant ||
      grant.userId !== ctx.userId ||
      grant.disconnectedAt !== undefined
    )
      throw new ConvexError({ message: "Calendar connection not found" });
    const sources = await ctx.db
      .query("calendarSources")
      .withIndex("by_grant", (q) => q.eq("grantId", grantId))
      .collect();
    for (const id of new Set(calendarIds)) {
      const calendar = grant.calendars.find((c) => c.id === id);
      if (!calendar)
        throw new ConvexError({
          message: "Choose a calendar from this connection",
        });
      if (
        sources.some(
          (s) => s.calendarId === id && s.disconnectedAt === undefined
        )
      )
        continue;
      const duplicate = await ctx.db
        .query("calendarSources")
        .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
        .collect();
      if (
        duplicate.some(
          (s) => s.calendarId === id && s.disconnectedAt === undefined
        )
      )
        throw new ConvexError({ message: "This calendar is already imported" });
      const previous = duplicate.find((s) => s.calendarId === id);
      const values = {
        userId: ctx.userId,
        grantId,
        calendarId: id,
        title: calendar.title,
        timezone: calendar.timezone,
        access: grant.access,
        generation: (previous?.generation ?? -1) + 1,
        disconnectedAt: undefined,
        refreshingUntil: undefined,
        lastAttemptAt: undefined,
        lastSuccessAt: undefined,
        error: undefined,
      };
      const sourceId =
        previous?._id ?? (await ctx.db.insert("calendarSources", values));
      if (previous) await ctx.db.patch(sourceId, values);
      await ctx.scheduler.runAfter(0, internal.googleCalendar.refresh, {
        sourceId,
      });
    }
  },
});

export const refresh = authedMutation({
  args: { sourceId: v.id("calendarSources") },
  rateLimit: { name: "refreshCalendar" },
  handler: async (ctx, { sourceId }) => {
    const source = await ctx.db.get(sourceId);
    if (
      !source ||
      source.userId !== ctx.userId ||
      source.disconnectedAt !== undefined
    )
      throw new ConvexError({ message: "Calendar Source not found" });
    await ctx.scheduler.runAfter(0, internal.googleCalendar.refresh, {
      sourceId,
    });
  },
});

async function detachSource(
  ctx: AuthedMutationCtx,
  source: Doc<"calendarSources">,
  removeRecords: boolean
) {
  if (source.disconnectedAt !== undefined && !removeRecords) return;
  await ctx.db.patch(source._id, {
    disconnectedAt: Date.now(),
    generation: source.generation + 1,
    refreshingUntil: undefined,
  });
  for (const event of await ctx.db
    .query("fixedEvents")
    .withIndex("by_source", (q) => q.eq("sourceId", source._id))
    .collect()) {
    if (removeRecords) await ctx.db.delete(event._id);
  }
}

export const disconnectSourceTool = planningTool({
  args: { sourceId: v.id("calendarSources"), removeRecords: v.boolean() },
  rateLimit: { name: "disconnectCalendarSource" },
  handler: async (ctx, { sourceId, removeRecords }) => {
    const source = await ctx.db.get(sourceId);
    if (!source || source.userId !== ctx.userId)
      throw new ConvexError({ message: "Calendar Source not found" });
    await detachSource(ctx, source, removeRecords);
    await autoPlan(ctx);
  },
});

export const disconnect = authedMutation({
  args: { grantId: v.id("calendarGrants"), removeRecords: v.boolean() },
  rateLimit: { name: "disconnectCalendar" },
  handler: async (ctx, { grantId, removeRecords }) => {
    const grant = await ctx.db.get(grantId);
    if (!grant || grant.userId !== ctx.userId)
      throw new ConvexError({ message: "Calendar connection not found" });
    if (grant.disconnectedAt !== undefined) return;
    await ctx.db.patch(grantId, {
      credentials: undefined,
      disconnectedAt: Date.now(),
      calendars: [],
    });
    const pending = await ctx.db.query("calendarAuthorizations").collect();
    for (const auth of pending)
      if (auth.userId === ctx.userId) await ctx.db.delete(auth._id);
    for (const source of await ctx.db
      .query("calendarSources")
      .withIndex("by_grant", (q) => q.eq("grantId", grantId))
      .collect()) {
      await detachSource(ctx, source, removeRecords);
    }
    await autoPlan(ctx);
  },
});

export const claimRefresh = internalMutation({
  args: { sourceId: v.id("calendarSources") },
  handler: async (ctx, { sourceId }) => {
    const source = await ctx.db.get(sourceId);
    if (
      !source ||
      source.disconnectedAt !== undefined ||
      (source.refreshingUntil ?? 0) > Date.now()
    )
      return null;
    const grant = await ctx.db.get(source.grantId);
    if (!grant?.credentials || grant.disconnectedAt !== undefined) return null;
    const generation = source.generation + 1;
    await ctx.db.patch(sourceId, {
      generation,
      lastAttemptAt: Date.now(),
      refreshingUntil: Date.now() + 4 * 60_000,
    });
    return { ...source, generation, credentials: grant.credentials };
  },
});

export const active = internalQuery({
  args: { sourceId: v.id("calendarSources"), generation: v.number() },
  handler: async (ctx, { sourceId, generation }) => {
    const source = await ctx.db.get(sourceId);
    return (
      !!source &&
      source.disconnectedAt === undefined &&
      source.generation === generation
    );
  },
});

export const applyRefresh = internalMutation({
  args: {
    sourceId: v.id("calendarSources"),
    generation: v.number(),
    scopeStart: v.number(),
    scopeEnd: v.number(),
    events: v.array(v.object(importedEventFields)),
    cancelledIds: v.array(v.string()),
  },
  handler: async (
    ctx,
    { sourceId, generation, scopeStart, scopeEnd, events, cancelledIds }
  ) => {
    const source = await ctx.db.get(sourceId);
    if (
      !source ||
      source.disconnectedAt !== undefined ||
      source.generation !== generation
    )
      return;
    const previous = await ctx.db
      .query("fixedEvents")
      .withIndex("by_source", (q) => q.eq("sourceId", sourceId))
      .collect();
    const seen = new Set<string>();
    for (const event of events) {
      if (
        seen.has(event.sourceEventId) ||
        !Number.isFinite(event.startAt) ||
        !Number.isFinite(event.endAt) ||
        event.endAt <= event.startAt
      )
        throw new Error("Invalid calendar response");
      seen.add(event.sourceEventId);
      const existing = previous.find(
        (e) => e.sourceEventId === event.sourceEventId
      );
      const values = {
        ...event,
        location: event.location,
        meetingLink: event.meetingLink,
        sourceUrl: event.sourceUrl,
        sourceStatus: event.sourceStatus,
        recurrence: event.recurrence,
        recurringEventId: event.recurringEventId,
        originalStart: event.originalStart,
        iCalUID: event.iCalUID,
        allDayStart: event.allDayStart,
        allDayEnd: event.allDayEnd,
        sourceTitle: source.title,
        sourceAccess: source.access,
        deletedAt: undefined,
      };
      if (existing) await ctx.db.patch(existing._id, values);
      else
        await ctx.db.insert("fixedEvents", {
          ...values,
          userId: source.userId,
          sourceId,
          attention: "focused",
          attentionUncertain: true,
        });
    }
    for (const event of previous) {
      const cancelled = cancelledIds.includes(event.sourceEventId!);
      if (
        cancelled ||
        (!seen.has(event.sourceEventId!) &&
          event.startAt < scopeEnd &&
          event.endAt > scopeStart)
      )
        await ctx.db.patch(event._id, {
          deletedAt: event.deletedAt ?? Date.now(),
          sourceStatus: cancelled ? "cancelled" : "missing",
        });
    }
    await ctx.db.patch(sourceId, {
      lastSuccessAt: Date.now(),
      error: undefined,
      refreshingUntil: undefined,
      scopeStart,
      scopeEnd,
    });
    await autoPlan({ ...ctx, userId: source.userId });
  },
});

export const failRefresh = internalMutation({
  args: { sourceId: v.id("calendarSources"), generation: v.number() },
  handler: async (ctx, { sourceId, generation }) => {
    const source = await ctx.db.get(sourceId);
    if (
      source &&
      source.disconnectedAt === undefined &&
      source.generation === generation
    )
      await ctx.db.patch(sourceId, {
        error:
          "Calendar refresh failed. Previous Events are preserved. Retry or reconnect the account.",
        refreshingUntil: undefined,
      });
  },
});

export const refreshDue = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const source of await ctx.db.query("calendarSources").collect())
      if (
        source.disconnectedAt === undefined &&
        (source.refreshingUntil ?? 0) <= Date.now() &&
        (source.lastAttemptAt ?? 0) <= Date.now() - 4 * 60_000
      )
        await ctx.scheduler.runAfter(0, internal.googleCalendar.refresh, {
          sourceId: source._id,
        });
  },
});

export const disconnectSource = authedMutation(disconnectSourceTool);
