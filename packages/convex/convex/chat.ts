import { partial } from "convex-helpers/validators";
import { ConvexError, GenericId, v, Value } from "convex/values";

import { planningFields } from "@gc/db";
import {
  localDateTime,
  locationConflicts,
  overlaps,
  placementConflicts,
} from "@gc/validators";

import { internal } from "./_generated/api";
import { Doc, Id, TableNames } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";
import * as calendars from "./calendars";
import { taskQueries } from "./dbQueries";
import * as mail from "./mail";
import * as planning from "./planning";
import * as projects from "./projects";
import * as sessions from "./sessions";
import * as tags from "./tags";
import * as taskActions from "./taskActions";
import * as tasks from "./tasks";
import {
  authedMutation,
  AuthedMutationCtx,
  authedQuery,
  AuthedQueryCtx,
} from "./utils/authedFunctions";
import { autoPlan } from "./utils/autoPlan";
import { planningTool } from "./utils/planningTool";
import { priorityContext, suggestPriority } from "./utils/taskPriority";

const {
  taskId: _taskId,
  editScope: _editScope,
  ...editableTaskFields
} = tasks.updateTool.args;
const updateTaskTool = planningTool({
  args: {
    taskId: v.id("tasks"),
    changes: v.object(partial(editableTaskFields)),
    editScope: v.optional(
      v.union(v.literal("occurrence"), v.literal("future"))
    ),
    clearFinishDate: v.optional(v.boolean()),
    stopRecurrence: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { taskId, changes, editScope, clearFinishDate, stopRecurrence }
  ) => {
    const task = await taskQueries({ ctx }).getById({ taskId });
    if ((task.seriesId || task.recurrence) && !editScope)
      throw new ConvexError(
        "Apply this change to this Occurrence or this and future Occurrences?"
      );
    const series = task.seriesId ? await ctx.db.get(task.seriesId) : task;
    const links = await ctx.db
      .query("tagTasks")
      .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
      .collect();
    const merged = {
      ...task,
      recurrence: series?.recurrence,
      ...changes,
      tags: changes.tags ?? links.map((l) => l.tagId),
      taskId,
      editScope,
    };
    const input = Object.fromEntries(
      Object.keys(tasks.updateTool.args)
        .filter((key) => key in merged)
        .map((key) => [key, merged[key as keyof typeof merged]])
    );
    input.priority = changes.priority;
    if (clearFinishDate) {
      input.dueAt = undefined;
      input.finishKind = undefined;
    }
    if (stopRecurrence) input.recurrence = undefined;
    return tasks.updateTool.invoke(ctx, input);
  },
});

const progressTool = planningTool({
  args: {
    taskId: v.id("tasks"),
    value: v.optional(v.number()),
    done: v.optional(v.boolean()),
    correction: v.optional(v.boolean()),
  },
  handler: async (ctx, { taskId, value, done, correction }) => {
    const task = await taskQueries({ ctx }).getById({ taskId });
    if (task.valueKind === "boolean") {
      if (done === undefined)
        throw new ConvexError("Did you finish this Task?");
      return taskActions.addTool.invoke(ctx, { taskId, boolValue: done });
    }
    if (
      task.valueKind !== "number" ||
      value === undefined ||
      !Number.isFinite(value) ||
      value < 0
    )
      throw new ConvexError(
        "Enter a nonnegative progress value in the Task's units"
      );
    const numValue =
      task.progressMeasure === "percentage" || correction
        ? value
        : (task.currentNumValue ?? task.initialNumValue ?? 0) + value;
    return taskActions.addTool.invoke(ctx, { taskId, numValue });
  },
});

const dateAvailabilityTool = planningTool({
  args: { override: planningFields.overrides.element, timezone: v.string() },
  handler: async (ctx, { override, timezone }) => {
    const settings = await ctx.db
      .query("planningSettings")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .first();
    const input = {
      timezone: settings?.timezone ?? timezone,
      weekly: settings?.weekly ?? [],
      overrides: [
        ...(settings?.overrides ?? []).filter(
          (row) => row.date !== override.date
        ),
        override,
      ],
      protectedWeekly: settings?.protectedWeekly ?? [],
      protectedDates: settings?.protectedDates ?? [],
    };
    for (const key of [
      "weekStartsOn",
      "restrictAvailability",
      "recoveryWindowDays",
      "dailyRecoveryMinutes",
      "reservePreferredMinutes",
      "reserveMinimumMinutes",
    ] as const) {
      if (settings?.[key] !== undefined)
        Object.assign(input, { [key]: settings[key] });
    }
    return planning.saveSettingsTool.invoke(ctx, input);
  },
});

export const tools = {
  createTask: tasks.createTool,
  updateTask: updateTaskTool,
  setPriority: tasks.setPriorityTool,
  removeMailSource: mail.disconnectTool,
  removeCalendarSource: calendars.disconnectSourceTool,
  archiveTasks: tasks.archiveTool,
  saveProject: projects.saveProjectTool,
  saveMilestone: projects.createMilestoneTool,
  saveAvailability: planning.saveSettingsTool,
  setDateAvailability: dateAvailabilityTool,
  saveEvent: planning.saveEventTool,
  deleteEvent: planning.deleteEventTool,
  scheduleTask: planning.scheduleTaskTool,
  planDay: planning.planDayTool,
  saveSession: sessions.saveSessionTool,
  unscheduleSession: sessions.unscheduleSessionTool,
  reportCheckIn: sessions.reportCheckInTool,
  recordProgress: progressTool,
  createCategory: tags.createTool,
  updateCategory: tags.updateTool,
};

function toolFor(name: string) {
  if (!Object.hasOwn(tools, name))
    throw new ConvexError("Unsupported planning tool");
  return tools[name as keyof typeof tools];
}

async function conversation(ctx: AuthedQueryCtx, id: Id<"chatConversations">) {
  const row = await ctx.db.get(id);
  if (!row || row.userId !== ctx.userId)
    throw new ConvexError("Conversation not found");
  return row;
}

export async function permitted(
  ctx: AuthedQueryCtx,
  row: Record<string, unknown>
) {
  if (row.userId !== ctx.userId) return false;
  if (row.sourceId) return false;
  for (const [field, table, flag] of [
    ["mailSourceId", "mailSources", "aiAllowed"],
    ["jiraSourceId", "jiraSources", "aiEnabled"],
    ["workSourceId", "workCalendarSources", "aiEnabled"],
  ] as const) {
    if (!row[field]) continue;
    const id = ctx.db.normalizeId(table, String(row[field]));
    const source = id && (await ctx.db.get(id));
    if (
      !source ||
      source.userId !== ctx.userId ||
      !source[flag as keyof typeof source]
    )
      return false;
    if ("connected" in source && (!source.connected || source.excluded))
      return false;
  }
  return true;
}

export const context = authedQuery({
  args: {
    text: v.string(),
    conversationId: v.optional(v.id("chatConversations")),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, { text, conversationId, timezone }) => {
    if (conversationId) await conversation(ctx, conversationId);
    const records: Record<string, unknown>[] = [];
    const candidates = await ctx.db
      .query("tasks")
      .withIndex("by_user_priority", (q) => q.eq("userId", ctx.userId))
      .collect();
    const events = await ctx.db
      .query("fixedEvents")
      .withIndex("by_user_start", (q) => q.eq("userId", ctx.userId))
      .collect();
    const words = text
      .toLocaleLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 2);
    for (const row of [...candidates, ...events]) {
      if (
        !(await permitted(ctx, row)) ||
        ("deletedAt" in row && row.deletedAt !== undefined) ||
        ("archivedAt" in row && row.archivedAt !== undefined)
      )
        continue;
      if (
        !words.some((word) => row.title.toLocaleLowerCase().includes(word)) &&
        !text.includes(row._id)
      )
        continue;
      if (records.length >= 15) break;
      const { userId: _userId, _creationTime: _time, ...raw } = row;
      const data = Object.fromEntries(
        Object.entries(raw).filter(
          ([key]) =>
            ![
              "description",
              "sourceSnapshot",
              "jiraSourceSnapshot",
              "suggestedReply",
            ].includes(key)
        )
      );
      records.push(data);
    }
    const sourceRecords = [
      ...(
        await ctx.db
          .query("mailSources")
          .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
          .collect()
      ).map((r) => ({
        _id: r._id,
        labelName: r.labelName,
        connected: r.connected,
      })),
      ...(
        await ctx.db
          .query("calendarSources")
          .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
          .collect()
      ).map((r) => ({
        _id: r._id,
        title: r.title,
        disconnectedAt: r.disconnectedAt,
      })),
    ].filter(
      (r) =>
        text.includes(r._id) ||
        words.some((w) =>
          ("title" in r ? r.title : r.labelName).toLocaleLowerCase().includes(w)
        )
    );
    records.push(...sourceRecords.slice(0, 5));
    const taskIds = new Set(records.map((r) => r._id));
    for (const session of await ctx.db
      .query("sessions")
      .withIndex("by_user_start", (q) => q.eq("userId", ctx.userId))
      .collect()) {
      if (
        taskIds.has(session.taskId) &&
        session.unscheduledAt === undefined &&
        records.length < 30
      )
        records.push(session);
    }
    const settings = await ctx.db
      .query("planningSettings")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .first();
    const preferences = conversationId
      ? await ctx.db
          .query("chatPreferences")
          .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
          .collect()
      : [];
    const relevant = (row: { _id: string; title?: string; name?: string }) =>
      text.includes(row._id) ||
      words.some((word) =>
        (row.title ?? row.name ?? "").toLocaleLowerCase().includes(word)
      );
    const categories = (
      await ctx.db
        .query("tags")
        .withIndex("by_userId_name", (q) => q.eq("userId", ctx.userId))
        .collect()
    )
      .filter(relevant)
      .slice(0, 15);
    const projectRecords = (
      await ctx.db
        .query("projects")
        .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
        .collect()
    )
      .filter(relevant)
      .slice(0, 15);
    const milestones = (
      await ctx.db
        .query("milestones")
        .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
        .collect()
    )
      .filter(
        (row) =>
          relevant(row) ||
          projectRecords.some((project) => project._id === row.projectId)
      )
      .slice(0, 15);
    const importance = await priorityContext(ctx);
    const priorityExplanations = records
      .filter((row): row is Doc<"tasks"> => "taskTypeId" in row)
      .map((task) => ({
        taskId: task._id,
        current: task.priority ?? "normal",
        automatic: task.automaticPriority === true,
        suggested: suggestPriority(task, importance).priority,
        signals: suggestPriority(task, importance).signals,
        urgency:
          "Separate deadline pressure; skips and delays do not lower importance",
      }));
    return {
      priorityExplanations,
      now: localDateTime(Date.now(), settings?.timezone ?? timezone ?? "UTC"),
      timezone: settings?.timezone ?? timezone ?? "UTC",
      settings,
      records,
      preferences: preferences
        .filter((p) => !p.priority)
        .slice(-5)
        .map((p) => p.text),
      taskTypes: await ctx.db
        .query("taskTypes")
        .withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
        .collect(),
      priorityClasses: await ctx.db
        .query("priorityClasses")
        .withIndex("by_userId_orderKey", (q) => q.eq("userId", ctx.userId))
        .collect(),
      categories,
      projects: projectRecords,
      milestones,
      tools: Object.fromEntries(
        Object.entries(tools).map(([name, tool]) => [name, tool.schema])
      ),
    };
  },
});

export const lastOperation = authedQuery({
  args: { conversationId: v.id("chatConversations") },
  handler: async (ctx, { conversationId }) => {
    await conversation(ctx, conversationId);
    const rows = await ctx.db
      .query("chatOperations")
      .withIndex("by_user_request", (q) => q.eq("userId", ctx.userId))
      .collect();
    return (
      rows
        .filter(
          (r) =>
            r.conversationId === conversationId &&
            r.expiresAt > Date.now() &&
            r.status !== "undone"
        )
        .sort((a, b) => b._creationTime - a._creationTime)[0]?._id ?? null
    );
  },
});

export const byRequest = authedQuery({
  args: { requestId: v.string() },
  handler: async (ctx, { requestId }) => {
    const row = await ctx.db
      .query("chatOperations")
      .withIndex("by_user_request", (q) =>
        q.eq("userId", ctx.userId).eq("requestId", requestId)
      )
      .unique();
    if (!row) return null;
    const expired = row.expiresAt <= Date.now();
    return {
      id: expired ? undefined : row._id,
      status: expired && row.status === "pending" ? "undone" : row.status,
    };
  },
});

export const history = authedQuery({
  args: { conversationId: v.id("chatConversations") },
  handler: async (ctx, { conversationId }) => {
    await conversation(ctx, conversationId);
    return ctx.db
      .query("chatMessages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId)
      )
      .collect();
  },
});
export const list = authedQuery({
  args: {},
  handler: (ctx) =>
    ctx.db
      .query("chatConversations")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect(),
});
export const create = authedMutation({
  args: {},
  handler: (ctx) =>
    ctx.db.insert("chatConversations", {
      userId: ctx.userId,
      title: "Planning chat",
    }),
});
export const remove = authedMutation({
  args: { conversationId: v.id("chatConversations") },
  handler: async (ctx, { conversationId }) => {
    await conversation(ctx, conversationId);
    for (const row of await ctx.db
      .query("chatMessages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId)
      )
      .collect())
      await ctx.db.delete(row._id);
    const operations = await ctx.db
      .query("chatOperations")
      .withIndex("by_user_request", (q) => q.eq("userId", ctx.userId))
      .collect();
    for (const row of operations)
      if (row.conversationId === conversationId)
        await ctx.db.patch(row._id, {
          conversationId: undefined,
          input: "{}",
          context: "{}",
          changes: undefined,
          tool: "",
          expiresAt: 0,
          status: row.status === "pending" ? "undone" : row.status,
        });
    await ctx.db.delete(conversationId);
  },
});
export const preferences = authedQuery({
  args: {},
  handler: (ctx) =>
    ctx.db
      .query("chatPreferences")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect(),
});
export const savePreference = authedMutation({
  args: { text: v.string() },
  handler: (ctx, { text }) => {
    if (!text.trim() || text.length > 1000)
      throw new ConvexError("Enter a preference up to 1000 characters");
    return ctx.db.insert("chatPreferences", {
      userId: ctx.userId,
      text: text.trim(),
    });
  },
});
export const removePreference = authedMutation({
  args: { id: v.id("chatPreferences") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row || row.userId !== ctx.userId)
      throw new ConvexError("Preference not found");
    await ctx.db.delete(id);
    await autoPlan(ctx);
  },
});
export const append = authedMutation({
  args: {
    conversationId: v.id("chatConversations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    await conversation(ctx, args.conversationId);
    if (args.text.length > 16000) throw new ConvexError("Message too long");
    await ctx.db.insert("chatMessages", { ...args, userId: ctx.userId });
  },
});

async function checkInput(
  ctx: AuthedMutationCtx,
  input: Record<string, unknown>,
  allowed: string[],
  currentRecords: Record<string, unknown>[]
) {
  for (const [key, value] of Object.entries(input)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      await checkInput(
        ctx,
        value as Record<string, unknown>,
        allowed,
        currentRecords
      );
      continue;
    }
    if (!key.endsWith("Id") && !key.endsWith("Ids") && key !== "tags") continue;
    for (const id of Array.isArray(value) ? value : value ? [value] : []) {
      if (typeof id !== "string" || !allowed.includes(id))
        throw new ConvexError(
          "Record was not in authorized context; clarify the target"
        );
      const row = await ctx.db.get(id as GenericId<TableNames>);
      if (!row || !(await permitted(ctx, row)))
        throw new ConvexError("Record is no longer authorized");
      currentRecords.push(row);
    }
  }
}

export const propose = authedMutation({
  args: {
    requestId: v.string(),
    tool: v.string(),
    input: v.string(),
    context: v.string(),
    conversationId: v.optional(v.id("chatConversations")),
  },
  handler: async (ctx, args): Promise<Id<"chatOperations">> => {
    if (args.conversationId) await conversation(ctx, args.conversationId);
    if (
      args.requestId.length > 128 ||
      args.input.length > 16000 ||
      args.context.length > 64000
    )
      throw new ConvexError("Chat operation too large");
    const previous = await ctx.db
      .query("chatOperations")
      .withIndex("by_user_request", (q) =>
        q.eq("userId", ctx.userId).eq("requestId", args.requestId)
      )
      .unique();
    if (previous) return previous._id;
    toolFor(args.tool);
    const id = await ctx.db.insert("chatOperations", {
      ...args,
      userId: ctx.userId,
      status: "pending",
      expiresAt: Date.now() + 15 * 60000,
    });
    await ctx.scheduler.runAfter(15 * 60000, internal.chat.expire, { id });
    return id;
  },
});
export const expire = internalMutation({
  args: { id: v.id("chatOperations") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (row)
      await ctx.db.patch(id, {
        input: "{}",
        context: "{}",
        changes: undefined,
        tool: "",
        conversationId: undefined,
        expiresAt: 0,
        status: row.status === "pending" ? "undone" : row.status,
      });
  },
});

export function needsConfirmation(
  tool: string,
  input: Record<string, unknown>,
  records: Record<string, unknown>[]
) {
  return (
    tool === "removeMailSource" ||
    tool === "removeCalendarSource" ||
    tool === "saveAvailability" ||
    (tool === "archiveTasks" &&
      ((Array.isArray(input.taskIds) && input.taskIds.length > 1) ||
        records.some(
          (record) =>
            record.recurrence &&
            Array.isArray(input.taskIds) &&
            input.taskIds.includes(record._id)
        ))) ||
    input.allowConflict === true ||
    input.replanAll === true ||
    input.stopRecurrence === true ||
    (input.changes &&
      typeof input.changes === "object" &&
      "recurrence" in input.changes) ||
    (tool === "updateTask" &&
      (input.recurrence !== undefined ||
        records.some(
          (r) => r._id === input.taskId && (r.seriesId || r.recurrence)
        ))) ||
    records.some((r) => r._id === input.sessionId && r.pinned) ||
    input.pinned === false
  );
}

export const operation = authedQuery({
  args: { id: v.id("chatOperations") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row || row.userId !== ctx.userId || row.expiresAt <= Date.now())
      return null;
    const input = JSON.parse(row.input) as Record<string, unknown>;
    const records =
      (JSON.parse(row.context) as { records?: Record<string, unknown>[] })
        .records ?? [];
    const preview = Object.entries(input)
      .flatMap(([key, value]) =>
        key === "changes" && value && typeof value === "object"
          ? Object.entries(value)
          : [[key, value]]
      )
      .map(([key, value]) => {
        if (Array.isArray(value))
          value = value.map((item) =>
            typeof item === "string"
              ? (records.find((record) => record._id === item)?.title ?? item)
              : item
          );
        if (typeof value === "string")
          value =
            records.find((r) => r._id === value)?.title ??
            records.find((r) => r._id === value)?.labelName ??
            value;
        if (
          (key === "startAt" || key === "endAt" || key === "dueAt") &&
          typeof value === "number"
        )
          value = new Date(value).toISOString();
        return {
          field: String(key)
            .replace(/([A-Z])/g, " $1")
            .replace(/ Ids?$/, "")
            .toLocaleLowerCase(),
          value:
            typeof value === "object" ? JSON.stringify(value) : String(value),
        };
      });
    return {
      preview,
      id: row._id,
      tool: row.tool,
      input: row.input,
      status: row.status,
      canUndo: !!row.changes,
    };
  },
});

type Change = {
  id: Id<TableNames>;
  table: TableNames;
  before: Record<string, Value> | null;
  after: Record<string, Value> | null;
};
const tables = [
  "tasks",
  "sessions",
  "fixedEvents",
  "projects",
  "milestones",
  "planningSettings",
  "dayPlans",
  "tags",
  "tagTasks",
  "taskActions",
  "recoveryRequests",
] as const;
function equal(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function apply(
  ctx: AuthedMutationCtx,
  id: Id<"chatOperations">,
  confirmed: boolean
) {
  const row = await ctx.db.get(id);
  if (!row || row.userId !== ctx.userId || row.expiresAt <= Date.now())
    throw new ConvexError("Chat action expired");
  if (row.status !== "pending") return { status: row.status, id };
  const input = JSON.parse(row.input) as Record<string, unknown>;
  const context = JSON.parse(row.context) as {
    allowed: string[];
    records: Record<string, unknown>[];
  };
  const currentRecords: Record<string, unknown>[] = [];
  await checkInput(ctx, input, context.allowed, currentRecords);
  for (const original of context.records) {
    const current = await ctx.db.get(original._id as Id<TableNames>);
    if (!current || !(await permitted(ctx, current)))
      throw new ConvexError("Context permissions changed; retry");
    for (const [key, value] of Object.entries(original))
      if (!equal(current[key as keyof typeof current], value))
        throw new ConvexError(
          "Planning records changed; retry with current records"
        );
  }
  if (needsConfirmation(row.tool, input, currentRecords) && !confirmed)
    return { status: "pending", id };
  const changes = new Map<string, Change>();
  const db = new Proxy(ctx.db, {
    get(target, property) {
      if (["patch", "replace", "delete"].includes(String(property)))
        return async (recordId: Id<TableNames>, ...args: unknown[]) => {
          if (!changes.has(recordId)) {
            const table = tables.find((t) => target.normalizeId(t, recordId));
            if (!table) throw new ConvexError("Unsupported chat write");
            const original = await target.get(recordId);
            const before = original ? structuredClone(original) : null;
            changes.set(recordId, { id: recordId, table, before, after: null });
          }
          return Reflect.apply(target[property as "patch"], target, [
            recordId,
            ...args,
          ]);
        };
      if (property === "insert")
        return async (table: TableNames, value: unknown) => {
          if (!(tables as readonly string[]).includes(table))
            throw new ConvexError("Unsupported chat write");
          const recordId = await Reflect.apply(target.insert, target, [
            table,
            value,
          ]);
          changes.set(recordId, {
            id: recordId,
            table,
            before: null,
            after: null,
          });
          return recordId;
        };
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const sourceRemoval =
    row.tool === "removeMailSource" || row.tool === "removeCalendarSource";
  await toolFor(row.tool).invoke(sourceRemoval ? ctx : { ...ctx, db }, input);
  if (sourceRemoval) {
    const old = await ctx.db
      .query("chatOperations")
      .withIndex("by_user_request", (q) => q.eq("userId", ctx.userId))
      .collect();
    for (const operation of old)
      if (operation._id !== id)
        await ctx.db.patch(operation._id, {
          status: operation.status === "pending" ? "undone" : operation.status,
          expiresAt: 0,
          conversationId: undefined,
          tool: "",
          changes: undefined,
          input: "{}",
          context: "{}",
        });
  }
  for (const change of changes.values())
    change.after = await ctx.db.get(change.id);
  await ctx.db.patch(id, {
    status: "applied",
    changes: sourceRemoval ? undefined : JSON.stringify([...changes.values()]),
    ...(sourceRemoval ? { context: "{}", input: "{}" } : {}),
  });
  return { status: "applied", id };
}
export const applyClear = authedMutation({
  args: { id: v.id("chatOperations") },
  handler: (ctx, { id }) => apply(ctx, id, false),
});
export const confirm = authedMutation({
  args: { id: v.id("chatOperations") },
  handler: (ctx, { id }) => apply(ctx, id, true),
});

export const undo = authedMutation({
  args: { id: v.id("chatOperations") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row || row.userId !== ctx.userId || row.expiresAt <= Date.now())
      throw new ConvexError("Undo expired");
    if (row.status !== "applied") return;
    if (!row.changes)
      throw new ConvexError(
        "Source removal cannot be undone; reconnect through Settings"
      );
    const changes = JSON.parse(row.changes) as Change[];
    const settings = await ctx.db
      .query("planningSettings")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .first();
    const events = (
      await ctx.db
        .query("fixedEvents")
        .withIndex("by_user_start", (q) => q.eq("userId", ctx.userId))
        .collect()
    ).filter((e) => e.deletedAt === undefined);
    const allSessions = await ctx.db
      .query("sessions")
      .withIndex("by_user_start", (q) => q.eq("userId", ctx.userId))
      .collect();
    const affected = new Set(changes.map((c) => c.id));
    const tasksNow = await ctx.db
      .query("tasks")
      .withIndex("by_user_priority", (q) => q.eq("userId", ctx.userId))
      .collect();
    const milestonesNow = await ctx.db
      .query("milestones")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect();
    const restored = (value: Record<string, Value>) => {
      const change = changes.find((c) => c.id === value._id);
      if (!change) return value;
      if (!change.before) return null;
      const result = { ...value };
      for (const key of new Set([
        ...Object.keys(change.before),
        ...Object.keys(change.after ?? {}),
      ])) {
        if (!equal(change.before[key], change.after?.[key])) {
          if (change.before[key] === undefined) delete result[key];
          else result[key] = change.before[key]!;
        }
      }
      return result;
    };
    const restoredSettings = settings
      ? (restored(settings) as Doc<"planningSettings"> | null)
      : null;
    const restoredEvents = (
      await ctx.db
        .query("fixedEvents")
        .withIndex("by_user_start", (q) => q.eq("userId", ctx.userId))
        .collect()
    )
      .map((e) => restored(e) as Doc<"fixedEvents"> | null)
      .filter((e): e is Doc<"fixedEvents"> => !!e && e.deletedAt === undefined);
    if (
      changes.some(
        (c) => c.table === "planningSettings" || c.table === "fixedEvents"
      )
    ) {
      for (const session of allSessions.filter(
        (s) => !affected.has(s._id) && s.unscheduledAt === undefined
      )) {
        const previous = placementConflicts(session, settings, events);
        if (
          placementConflicts(session, restoredSettings, restoredEvents).some(
            (conflict) => !previous.includes(conflict)
          )
        )
          throw new ConvexError(
            "Undo would conflict with later work; adjust the boundary individually"
          );
      }
    }
    for (const change of changes) {
      const current = await ctx.db.get(change.id);
      if (
        current &&
        (change.table === "tasks" || change.table === "fixedEvents") &&
        !(await permitted(ctx, current))
      )
        throw new ConvexError(
          "Source permissions changed; this action cannot be restored"
        );
      if (
        !change.before &&
        current &&
        ["tasks", "projects", "milestones"].includes(change.table)
      ) {
        if (
          [...tasksNow, ...milestonesNow, ...allSessions].some(
            (r) => !affected.has(r._id) && Object.values(r).includes(change.id)
          )
        )
          throw new ConvexError(
            "Other records now depend on this creation; adjust it individually"
          );
      }
      if (
        change.table === "sessions" &&
        current &&
        "startAt" in current &&
        current.startAt <= Date.now() &&
        (!("unscheduledAt" in current) || current.unscheduledAt === undefined)
      )
        throw new ConvexError(
          "Work has started; adjust the Session individually"
        );
      if (
        change.table === "sessions" &&
        current &&
        "pinned" in current &&
        current.pinned &&
        !change.after?.pinned
      )
        throw new ConvexError(
          "Session was pinned after this action; adjust it individually"
        );
      if (!change.before) {
        if (!equal(current, change.after))
          throw new ConvexError(
            "Created record changed; adjust it individually"
          );
      } else {
        for (const key of new Set([
          ...Object.keys(change.before),
          ...Object.keys(change.after ?? {}),
        ])) {
          if (
            !equal(change.before[key], change.after?.[key]) &&
            !equal(current?.[key as keyof typeof current], change.after?.[key])
          )
            throw new ConvexError(
              "Affected fields changed; adjust them individually"
            );
        }
      }
      if (
        change.table === "sessions" &&
        change.before &&
        change.before.unscheduledAt === undefined
      ) {
        const before = change.before as unknown as Doc<"sessions">;
        const task = await ctx.db.get(before.taskId);
        if (
          !task ||
          before.startAt <= Date.now() ||
          placementConflicts(before, restoredSettings, restoredEvents).length ||
          locationConflicts(before, task, restoredEvents).length ||
          allSessions.some(
            (s) =>
              !changes.some((c) => c.id === s._id) &&
              s.unscheduledAt === undefined &&
              overlaps(s, before)
          )
        )
          throw new ConvexError(
            "Previous placement is no longer feasible; adjust the Session individually"
          );
      }
    }
    for (const change of [...changes].reverse()) {
      const current = await ctx.db.get(change.id);
      if (!change.before) {
        if (current) await ctx.db.delete(change.id);
      } else if (!current) {
        const { _id: _id, _creationTime: _time, ...values } = change.before;
        if (change.table !== "tagTasks")
          throw new ConvexError("Record removed; adjust individually");
        await ctx.db.insert(
          "tagTasks",
          values as { taskId: Id<"tasks">; tagId: Id<"tags"> }
        );
      } else {
        const patch: Record<string, Value | undefined> = {};
        for (const key of new Set([
          ...Object.keys(change.before),
          ...Object.keys(change.after ?? {}),
        ]))
          if (
            !key.startsWith("_") &&
            !equal(change.before[key], change.after?.[key])
          )
            patch[key] = change.before[key];
        await ctx.db.patch(change.id, patch);
      }
    }
    await ctx.db.patch(id, {
      status: "undone",
      changes: undefined,
      input: "{}",
      context: "{}",
    });
  },
});
