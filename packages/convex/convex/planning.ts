import { ConvexError, v } from "convex/values";

import { fixedEventFields, planningFields } from "@gc/db";
import { validatePlanning } from "@gc/validators";

import { authedMutation, authedQuery } from "./utils/authedFunctions";

export const getSettings = authedQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("planningSettings")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .first(),
});

export const saveSettings = authedMutation({
  args: planningFields,
  rateLimit: { name: "savePlanningSettings" },
  handler: async (ctx, settings) => {
    try {
      validatePlanning(settings);
    } catch (error) {
      throw new ConvexError({
        message:
          error instanceof Error ? error.message : "Invalid Availability",
      });
    }
    const existing = await ctx.db
      .query("planningSettings")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, settings);
      return existing._id;
    }
    return ctx.db.insert("planningSettings", {
      ...settings,
      userId: ctx.userId,
    });
  },
});

export const listEvents = authedQuery({
  args: {},
  handler: async (ctx) =>
    (
      await ctx.db
        .query("fixedEvents")
        .withIndex("by_user_start", (q) => q.eq("userId", ctx.userId))
        .collect()
    ).filter((event) => event.deletedAt === undefined),
});

export const saveEvent = authedMutation({
  args: { eventId: v.optional(v.id("fixedEvents")), ...fixedEventFields },
  rateLimit: { name: "saveEvent" },
  handler: async (ctx, { eventId, ...event }) => {
    if (
      !event.title.trim() ||
      !Number.isFinite(event.startAt) ||
      !Number.isFinite(event.endAt) ||
      event.endAt <= event.startAt ||
      Math.abs(event.startAt) > 8640000000000000 ||
      Math.abs(event.endAt) > 8640000000000000
    )
      throw new ConvexError({
        message: "Enter an Event title and an end after its start",
      });
    try {
      new Intl.DateTimeFormat("en", { timeZone: event.timezone });
    } catch {
      throw new ConvexError({ message: "Enter a valid IANA timezone" });
    }
    const values = {
      ...event,
      title: event.title.trim(),
    };
    if (eventId) {
      const existing = await ctx.db.get(eventId);
      if (
        !existing ||
        existing.userId !== ctx.userId ||
        existing.deletedAt !== undefined
      )
        throw new ConvexError({ message: "Event not found" });
      await ctx.db.patch(eventId, values);
      return eventId;
    }
    return ctx.db.insert("fixedEvents", { ...values, userId: ctx.userId });
  },
});

export const deleteEvent = authedMutation({
  args: { eventId: v.id("fixedEvents") },
  rateLimit: { name: "deleteEvent" },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId);
    if (!event || event.userId !== ctx.userId)
      throw new ConvexError({ message: "Event not found" });
    await ctx.db.patch(eventId, { deletedAt: Date.now() });
  },
});
