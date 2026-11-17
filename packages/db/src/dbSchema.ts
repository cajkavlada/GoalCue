import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { aiDbSchema } from "./aiDbSchema";
import { calendarDbSchema } from "./calendarDbSchema";
import { eventsDbSchema } from "./eventsDbSchema";
import { mailDbSchema } from "./mailDbSchema";
import { planningDbSchema } from "./planningDbSchema";
import { priorityClassDbSchema } from "./priorityClassDbSchema";
import { repetitionDbSchema } from "./repetitionDbSchema";
import { tagDbSchema } from "./tagDbSchema";
import { taskDbSchema } from "./taskDbSchema";
import { taskTypeDbSchema } from "./taskTypeDbSchema";

export const dbSchema = defineSchema({
  chatConversations: defineTable({
    userId: v.string(),
    title: v.string(),
  }).index("by_user", ["userId"]),
  chatMessages: defineTable({
    userId: v.string(),
    conversationId: v.id("chatConversations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    text: v.string(),
  }).index("by_conversation", ["conversationId"]),
  chatPreferences: defineTable({
    userId: v.string(),
    text: v.string(),
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("normal"),
        v.literal("high"),
        v.literal("critical")
      )
    ),
    taskTypeId: v.optional(v.id("taskTypes")),
    projectId: v.optional(v.id("projects")),
    milestoneId: v.optional(v.id("milestones")),
  }).index("by_user", ["userId"]),
  chatOperations: defineTable({
    userId: v.string(),
    requestId: v.string(),
    conversationId: v.optional(v.id("chatConversations")),
    tool: v.string(),
    input: v.string(),
    context: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("applied"),
      v.literal("undone")
    ),
    expiresAt: v.number(),
    changes: v.optional(v.string()),
  }).index("by_user_request", ["userId", "requestId"]),
  ...aiDbSchema,
  users: defineTable({
    userId: v.string(),
  }).index("by_user", ["userId"]),
  ...taskDbSchema,
  ...taskTypeDbSchema,
  ...priorityClassDbSchema,
  ...tagDbSchema,
  ...eventsDbSchema,
  ...mailDbSchema,
  ...calendarDbSchema,
  ...planningDbSchema,
  ...repetitionDbSchema,
});
