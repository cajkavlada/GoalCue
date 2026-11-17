import { ConvexError, v } from "convex/values";
import { generateKeyBetween } from "fractional-indexing";

import { mapJiraRow, parseJiraCsv } from "@gc/validators";

import { Doc } from "./_generated/dataModel";
import { authedMutation, authedQuery } from "./utils/authedFunctions";
import { autoPlan } from "./utils/autoPlan";

export const list = authedQuery({
  args: {},
  handler: (ctx) =>
    ctx.db
      .query("jiraSources")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect(),
});

export const setBalancingBoard = authedMutation({
  args: { taskId: v.id("tasks"), board: v.string() },
  rateLimit: { name: "setJiraBalancingBoard" },
  handler: async (ctx, { taskId, board }) => {
    const task = await ctx.db.get(taskId);
    if (
      !task ||
      task.userId !== ctx.userId ||
      !task.jiraBoards?.includes(board)
    )
      throw new ConvexError({
        message: "Choose a Board belonging to this Task",
      });
    await ctx.db.patch(taskId, { jiraBalancingBoard: board });
    await autoPlan(ctx);
  },
});

export const importCsv = authedMutation({
  args: {
    instance: v.string(),
    job: v.string(),
    csv: v.string(),
    mapping: v.record(v.string(), v.string()),
    statusMapping: v.record(
      v.string(),
      v.union(v.literal("ready"), v.literal("paused"), v.literal("done"))
    ),
    priorityMapping: v.record(
      v.string(),
      v.union(
        v.literal("low"),
        v.literal("normal"),
        v.literal("high"),
        v.literal("critical")
      )
    ),
    fallbackMinutes: v.number(),
    taskTypeId: v.id("taskTypes"),
    priorityClassId: v.id("priorityClasses"),
  },
  rateLimit: { name: "importJiraCsv" },
  handler: async (ctx, args) => {
    const instance = args.instance
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/$/, "")
      .toLowerCase();
    const job = args.job.trim();
    if (
      !instance ||
      !job ||
      !Number.isFinite(args.fallbackMinutes) ||
      args.fallbackMinutes <= 0 ||
      args.fallbackMinutes > 10080
    )
      throw new ConvexError({
        message: "Enter Jira instance, Job, and fallback minutes (1–10080)",
      });
    if (args.csv.length > 500000)
      throw new ConvexError({ message: "Use a CSV smaller than 500 KB" });
    const type = await ctx.db.get(args.taskTypeId),
      priorityClass = await ctx.db.get(args.priorityClassId);
    if (
      !type ||
      type.userId !== ctx.userId ||
      type.archivedAt !== undefined ||
      !priorityClass ||
      priorityClass.userId !== ctx.userId ||
      priorityClass.archivedAt !== undefined
    )
      throw new ConvexError({
        message: "Choose an active Task type and Priority class",
      });
    let parsed;
    try {
      parsed = parseJiraCsv(args.csv);
    } catch (error) {
      throw new ConvexError({ message: (error as Error).message });
    }
    if (
      !args.mapping.identity ||
      !args.mapping.summary ||
      Object.values(args.mapping).some(
        (column) => column && !parsed.headers.includes(column)
      )
    )
      throw new ConvexError({
        message: "Map identity and summary to existing columns",
      });
    if (parsed.rows.length > 500)
      throw new ConvexError({ message: "Import at most 500 rows at once" });
    const sources = await ctx.db
      .query("jiraSources")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect();
    const source = sources.find(
      (s) => s.instance === instance && s.job === job
    );
    const sourceValues = {
      instance,
      job,
      userId: ctx.userId,
      mapping: args.mapping,
      statusMapping: args.statusMapping,
      priorityMapping: args.priorityMapping,
      fallbackMinutes: args.fallbackMinutes,
      importedAt: Date.now(),
    };
    const sourceId =
      source?._id ?? (await ctx.db.insert("jiraSources", sourceValues));
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect();
    const result = {
      imported: 0,
      changed: 0,
      unchanged: 0,
      rejected: [] as { row: number; reason: string }[],
    };
    const records = new Map<string, ReturnType<typeof mapJiraRow>>();
    const conflicting = new Set<string>();
    for (const [index, row] of parsed.rows.entries()) {
      try {
        const record = mapJiraRow(
          parsed.headers,
          row,
          args.mapping,
          args.fallbackMinutes
        );
        const previous = records.get(record.identity);
        if (previous) {
          if (
            JSON.stringify({ ...previous, boards: [] }) !==
            JSON.stringify({ ...record, boards: [] })
          ) {
            conflicting.add(record.identity);
            throw new Error(
              "Conflicting rows for the same issue; this issue was not imported"
            );
          }
          previous.boards = [
            ...new Set([...previous.boards, ...record.boards]),
          ];
        } else records.set(record.identity, record);
      } catch (error) {
        result.rejected.push({
          row: index + 2,
          reason: (error as Error).message,
        });
      }
    }
    const firstTask = await ctx.db
      .query("tasks")
      .withIndex("by_user_priority", (q) =>
        q.eq("userId", ctx.userId).eq("priorityClassId", args.priorityClassId)
      )
      .order("asc")
      .first();
    let priorityIndex = firstTask?.priorityIndex ?? null;
    const sprintDates = new Map<string, number>();
    const invalidSprints = new Set<string>();
    for (const record of records.values()) {
      if (
        !record.sprint ||
        record.sprintEnd === undefined ||
        conflicting.has(record.identity)
      )
        continue;
      const end = sprintDates.get(record.sprint);
      if (end !== undefined && end !== record.sprintEnd)
        invalidSprints.add(record.sprint);
      sprintDates.set(record.sprint, record.sprintEnd);
    }
    for (const record of records.values()) {
      if (conflicting.has(record.identity)) continue;
      if (invalidSprints.has(record.sprint)) {
        result.rejected.push({
          row:
            parsed.rows.findIndex(
              (row) =>
                row[parsed.headers.indexOf(args.mapping.identity!)]?.trim() ===
                record.identity
            ) + 2,
          reason: "Conflicting end dates for the same Sprint",
        });
        continue;
      }
      if (record.sprintEnd === undefined && sprintDates.has(record.sprint)) {
        record.sprintEnd = sprintDates.get(record.sprint);
        record.dueAt ??= record.sprintEnd;
      }
      const existing = await ctx.db
        .query("tasks")
        .withIndex("by_jira_identity", (q) =>
          q
            .eq("userId", ctx.userId)
            .eq("jiraInstance", instance)
            .eq("jiraIdentity", record.identity)
        )
        .first();
      const boards =
        existing && existing.jiraSourceId !== sourceId
          ? [...new Set([...(existing.jiraBoards ?? []), ...record.boards])]
          : record.boards;
      const balancingBoard = boards.includes(existing?.jiraBalancingBoard ?? "")
        ? existing!.jiraBalancingBoard
        : boards[0];
      let projectId = projects.find((p) => p.title === record.project)?._id;
      if (record.project && !projectId) {
        projectId = await ctx.db.insert("projects", {
          userId: ctx.userId,
          title: record.project,
          weeklyMinutes: 0,
          weekdays: [],
        });
        projects.push((await ctx.db.get(projectId))!);
      }
      const status = args.statusMapping[record.status] ?? "ready";
      const snapshot = {
        title: record.title,
        description: record.description,
        effortMinutes: record.effortMinutes,
        priority: args.priorityMapping[record.priority] ?? ("normal" as const),
        dueAt: record.dueAt,
        finishKind: record.finishKind,
        projectId,
        automaticSchedulingPaused: status !== "ready",
      };
      const jira = {
        link:
          record.link ||
          `https://${instance}/browse/${encodeURIComponent(record.identity)}`,
        status: record.status,
        assignee: record.assignee,
        project: record.project,
        parent: record.parent,
        sprint: record.sprint,
        sprintEnd: record.sprintEnd,
        storyPoints: record.storyPoints,
        estimateBasis: record.estimateBasis,
        snapshot,
      };
      if (existing) {
        const patch: Partial<Doc<"tasks">> = {
          jira,
          jiraBoards: boards,
          jiraBalancingBoard: balancingBoard,
        };
        const overrides = new Set(existing.jiraOverrides ?? []);
        for (const key of Object.keys(snapshot) as (keyof typeof snapshot)[])
          if (existing[key] !== existing.jira?.snapshot[key])
            overrides.add(key);
        if (overrides.has("dueAt") || overrides.has("finishKind")) {
          overrides.add("dueAt");
          overrides.add("finishKind");
        }
        for (const key of Object.keys(snapshot) as (keyof typeof snapshot)[]) {
          if (!overrides.has(key))
            Object.assign(patch, { [key]: snapshot[key] });
        }
        if (overrides.size) patch.jiraOverrides = [...overrides];
        if (
          Object.hasOwn(patch, "projectId") &&
          patch.projectId !== existing.projectId
        )
          patch.milestoneId = undefined;
        const changed = Object.entries(patch).some(
          ([key, value]) =>
            JSON.stringify(existing[key as keyof typeof existing]) !==
            JSON.stringify(value)
        );
        if (changed) {
          await ctx.db.patch(existing._id, patch);
          result.changed++;
        } else result.unchanged++;
      } else {
        priorityIndex = generateKeyBetween(null, priorityIndex);
        await ctx.db.insert("tasks", {
          ...snapshot,
          jira,
          jiraSourceId: sourceId,
          jiraInstance: instance,
          jiraIdentity: record.identity,
          jiraBoards: boards,
          jiraBalancingBoard: balancingBoard,
          userId: ctx.userId,
          taskTypeId: args.taskTypeId,
          priorityClassId: args.priorityClassId,
          priorityIndex,
          valueKind: "boolean",
          progressMeasure: "done",
          ...(status === "done" ? { completedAt: Date.now() } : {}),
        });
        result.imported++;
      }
    }
    if (source) await ctx.db.patch(sourceId, sourceValues);
    await autoPlan(ctx);
    return result;
  },
});
