import { Doc } from "../_generated/dataModel";
import { AuthedQueryCtx } from "./authedFunctions";

export async function priorityContext(ctx: AuthedQueryCtx) {
  const [projects, milestones, preferences] = await Promise.all([
    ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect(),
    ctx.db
      .query("milestones")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect(),
    ctx.db
      .query("chatPreferences")
      .withIndex("by_user", (q) => q.eq("userId", ctx.userId))
      .collect(),
  ]);
  return { projects, milestones, preferences };
}

export function suggestPriority(
  task: Doc<"tasks">,
  context: Awaited<ReturnType<typeof priorityContext>>
) {
  const signals: {
    kind: string;
    title: string;
    priority: NonNullable<Doc<"tasks">["priority"]>;
  }[] = [];
  const project = context.projects.find((p) => p._id === task.projectId);
  const milestone = context.milestones.find((m) => m._id === task.milestoneId);
  if (project?.importance)
    signals.push({
      kind: "project",
      title: project.title,
      priority: project.importance,
    });
  if (milestone?.importance)
    signals.push({
      kind: "milestone",
      title: milestone.title,
      priority: milestone.importance,
    });
  const preferences = context.preferences
    .filter(
      (p) =>
        p.priority &&
        p.taskTypeId === task.taskTypeId &&
        p.projectId === task.projectId &&
        p.milestoneId === task.milestoneId
    )
    .sort(
      (a, b) => a._creationTime - b._creationTime || a._id.localeCompare(b._id)
    );
  for (const preference of preferences)
    if (preference.priority)
      signals.push({
        kind: "correction",
        title: preference.text,
        priority: preference.priority,
      });
  return {
    priority: signals.at(-1)?.priority ?? "normal",
    signals,
    preferences,
  };
}
