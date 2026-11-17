import { useState } from "react";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ChevronRight, Flag, FolderKanban, Plus } from "lucide-react";

import { api } from "@gc/convex/api";
import { Doc, Id } from "@gc/convex/types";
import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { getLocale } from "@gc/i18n/runtime";
import { ErrorSuspense } from "@gc/react-kit";
import { Button, Checkbox, Drawer, DrawerButton, useModal } from "@gc/ui";
import { dayBounds, shiftDate } from "@gc/validators";

import { TaskCreateDrawer } from "./task-create-drawer";
import { TaskEditDrawer } from "./task-edit-drawer";

export function ProjectFields({
  projectId,
  milestoneId,
  onChange,
}: {
  projectId?: Id<"projects">;
  milestoneId?: Id<"milestones">;
  onChange: (
    projectId?: Id<"projects">,
    milestoneId?: Id<"milestones">
  ) => void;
}) {
  const { data } = useSuspenseQuery(convexQuery(api.projects.list, {}));
  const form = useAppForm({
    defaultValues: {
      projectId: projectId ?? "none",
      milestoneId: milestoneId ?? "none",
    },
  });
  return (
    <div className="space-y-3">
      <form.AppField name="projectId">
        {(field) => (
          <field.Select<string>
            label={m.projects_project()}
            options={[
              { value: "none", label: m.projects_none() },
              ...data.projects.map((p) => ({ value: p._id, label: p.title })),
            ]}
            onValueChange={(value) => {
              form.setFieldValue("milestoneId", "none");
              onChange(
                value === "none" ? undefined : (value as Id<"projects">)
              );
            }}
          />
        )}
      </form.AppField>
      {projectId && (
        <form.AppField name="milestoneId">
          {(field) => (
            <field.Select<string>
              label={m.projects_milestone()}
              options={[
                { value: "none", label: m.projects_none() },
                ...data.milestones
                  .filter((p) => p.projectId === projectId)
                  .map((p) => ({ value: p._id, label: p.title })),
              ]}
              onValueChange={(value) =>
                onChange(
                  projectId,
                  value === "none" ? undefined : (value as Id<"milestones">)
                )
              }
            />
          )}
        </form.AppField>
      )}
    </div>
  );
}

function ProjectForm({
  project,
  onSave,
  drawer = false,
}: {
  project?: Doc<"projects">;
  onSave?: (projectId: Id<"projects">) => void;
  drawer?: boolean;
}) {
  const save = useConvexMutation(api.projects.saveProject);
  const { data: settings } = useSuspenseQuery(
    convexQuery(api.planning.getSettings, {})
  );
  const [weekdays, setWeekdays] = useState(project?.weekdays ?? []);
  const [error, setError] = useState("");
  const form = useAppForm({
    defaultValues: {
      title: project?.title ?? "",
      weeklyMinutes: project?.weeklyMinutes ?? 0,
      importance: project?.importance ?? "normal",
    },
    onSubmit: async ({ value }) => {
      try {
        const id = await save({ ...value, weekdays, projectId: project?._id });
        setError("");
        form.reset(value);
        onSave?.(id);
      } catch (error) {
        setError((error as Error).message);
      }
    },
  });
  const days = [
    m.constraints_sunday(),
    m.constraints_monday(),
    m.constraints_tuesday(),
    m.constraints_wednesday(),
    m.constraints_thursday(),
    m.constraints_friday(),
    m.constraints_saturday(),
  ];
  return (
    <form.AppForm>
      <form.FormRoot className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <form.AppField name="title">
          {(field) => (
            <field.Input
              autoFocus={!project}
              label={m.tasks_form_field_title_label()}
            />
          )}
        </form.AppField>
        <form.AppField name="importance">
          {(field) => (
            <field.Select
              label={m.priority_importance()}
              options={[
                { value: "low", label: m.planning_low() },
                { value: "normal", label: m.planning_normal() },
                { value: "high", label: m.planning_high() },
                { value: "critical", label: m.planning_critical() },
              ]}
            />
          )}
        </form.AppField>
        <form.AppField name="weeklyMinutes">
          {(field) => (
            <field.Input
              type="number"
              label={m.projects_weekly_short()}
              min={0}
              max={10080}
              step={1}
            />
          )}
        </form.AppField>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-medium">
            {m.projects_preferred_days()}
          </legend>
          <div className="grid max-w-md grid-cols-7 gap-1">
            {Array.from(
              { length: 7 },
              (_, i) => (i + (settings?.weekStartsOn ?? 1)) % 7
            ).map((index) => (
              <label
                key={index}
                className="cursor-pointer"
              >
                <Checkbox
                  className="peer sr-only"
                  checked={weekdays.includes(index)}
                  onCheckedChange={(checked) =>
                    setWeekdays(
                      checked
                        ? [...weekdays, index]
                        : weekdays.filter((d) => d !== index)
                    )
                  }
                />
                <span
                  aria-hidden="true"
                  className="peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-focus-visible:ring-ring flex h-9 items-center justify-center rounded-md border text-sm peer-focus-visible:ring-2"
                >
                  {new Intl.DateTimeFormat(getLocale(), {
                    weekday: "short",
                    timeZone: "UTC",
                  }).format(new Date(Date.UTC(2026, 10, 15 + index)))}
                </span>
                <span className="sr-only">{days[index]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="text-muted-foreground text-xs sm:col-span-2">
          {m.projects_compact_hint()}
        </p>
        {error && (
          <p
            role="alert"
            className="sm:col-span-2"
          >
            {error}
          </p>
        )}
        <div className="sm:col-span-2">
          {drawer ? (
            <Drawer.Footer>
              <form.SubmitButton />
            </Drawer.Footer>
          ) : (
            <form.SubmitButton />
          )}
        </div>
      </form.FormRoot>
    </form.AppForm>
  );
}

export function ProjectCreateDrawer({
  onCreate,
}: { onCreate?: (projectId: Id<"projects">) => void } = {}) {
  const { closeDrawer } = useModal();
  return (
    <Drawer
      title={m.projects_new()}
      description={m.projects_create_help()}
      customFooter
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ErrorSuspense>
          <ProjectForm
            drawer
            onSave={(id) => {
              onCreate?.(id);
              closeDrawer();
            }}
          />
        </ErrorSuspense>
      </div>
    </Drawer>
  );
}

function MilestoneForm({
  projectId,
  onClose,
}: {
  projectId: Id<"projects">;
  onClose: () => void;
}) {
  const create = useConvexMutation(api.projects.createMilestone);
  const [error, setError] = useState("");
  const form = useAppForm({
    defaultValues: {
      title: "",
      importance: "normal" as "low" | "normal" | "high" | "critical",
    },
    onSubmit: async ({ value }) => {
      try {
        await create({ ...value, projectId });
        form.reset();
        setError("");
        onClose();
      } catch (error) {
        setError((error as Error).message);
      }
    },
  });
  return (
    <form.AppForm>
      <form.FormRoot className="space-y-2">
        <form.AppField name="title">
          {(field) => (
            <field.Input
              autoFocus
              label={m.projects_new_milestone()}
            />
          )}
        </form.AppField>
        <form.AppField name="importance">
          {(field) => (
            <field.Select
              label={m.priority_importance()}
              options={[
                { value: "low", label: m.planning_low() },
                { value: "normal", label: m.planning_normal() },
                { value: "high", label: m.planning_high() },
                { value: "critical", label: m.planning_critical() },
              ]}
            />
          )}
        </form.AppField>
        {error && <p role="alert">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            {m.cancel()}
          </Button>
          <form.SubmitButton />
        </div>
      </form.FormRoot>
    </form.AppForm>
  );
}

export function ProjectsView({ date }: { date: string }) {
  const { data } = useSuspenseQuery(convexQuery(api.projects.list, {}));
  const { data: tasks } = useSuspenseQuery(
    convexQuery(api.planning.listWork, {})
  );
  const { data: sessions } = useSuspenseQuery(
    convexQuery(api.sessions.listSessions, {})
  );
  const { data: settings } = useSuspenseQuery(
    convexQuery(api.planning.getSettings, {})
  );
  const [selectedId, setSelectedId] = useState<Id<"projects"> | null>(null);
  const [addingMilestone, setAddingMilestone] = useState(false);
  const selected =
    data.projects.find((p) => p._id === selectedId) ?? data.projects[0];
  const projectTasks = tasks.filter((t) => t.projectId === selected?._id);
  const milestones = data.milestones.filter(
    (item) => item.projectId === selected?._id
  );
  const timezone =
    settings?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const weekday = new Date(`${date}T12:00Z`).getUTCDay();
  const weekStart = shiftDate(
    date,
    -((weekday - (settings?.weekStartsOn ?? 1) + 7) % 7)
  );
  const week = {
    startAt: dayBounds(weekStart, timezone).startAt,
    endAt: dayBounds(shiftDate(weekStart, 7), timezone).startAt,
  };
  const allocated = Math.round(
    sessions
      .filter(
        (s) =>
          s.projectId === selected?._id &&
          s.startAt < week.endAt &&
          s.endAt > week.startAt
      )
      .reduce(
        (total, s) =>
          total +
          ((s.checkIn ? s.checkIn.timeMinutes : (s.endAt - s.startAt) / 60000) *
            (Math.min(s.endAt, week.endAt) -
              Math.max(s.startAt, week.startAt))) /
            (s.endAt - s.startAt),
        0
      )
  );
  const weekLabel = new Intl.DateTimeFormat(getLocale(), {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${weekStart}T12:00Z`));
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b px-6 py-5">
        <div>
          <h1 className="text-xl font-semibold">{m.projects_title()}</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            {m.projects_intro()}
          </p>
        </div>
      </header>
      <div className="grid md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="bg-muted/20 border-b p-3 md:border-b-0 md:border-r">
          <nav
            aria-label={m.projects_title()}
            className="space-y-1"
          >
            {data.projects.map((project) => (
              <button
                type="button"
                key={project._id}
                aria-current={
                  selected?._id === project._id ? "page" : undefined
                }
                className={`hover:bg-accent focus-visible:ring-ring flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 ${selected?._id === project._id ? "bg-accent" : ""}`}
                onClick={() => {
                  setSelectedId(project._id);
                  setAddingMilestone(false);
                }}
              >
                <FolderKanban className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {project.title}
                </span>
                <ChevronRight className="size-4 shrink-0" />
              </button>
            ))}
            {!data.projects.length && (
              <p className="text-muted-foreground p-3 text-sm">
                {m.projects_empty()}
              </p>
            )}
          </nav>
        </aside>
        <main className="min-w-0 p-6 md:p-8">
          {selected ? (
            <div className="mx-auto max-w-3xl space-y-6">
              <ProjectForm
                key={selected._id}
                project={selected}
              />
              <section
                aria-label={m.projects_weekly_summary()}
                className="rounded-xl border"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <p className="text-muted-foreground text-xs">
                    {m.projects_week_of({ date: weekLabel })}
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {m.projects_allocated({ minutes: allocated })}
                  </p>
                </div>
                {selected.weeklyMinutes > 0 && (
                  <div
                    className="bg-muted/30 space-y-1 border-t px-5 py-3 text-sm"
                    role="status"
                  >
                    <p className="font-medium">
                      {allocated < selected.weeklyMinutes
                        ? m.projects_remaining({
                            minutes: selected.weeklyMinutes - allocated,
                          })
                        : m.projects_target_met()}
                    </p>
                    <p className="text-muted-foreground">
                      {allocated >= selected.weeklyMinutes
                        ? m.projects_allocation_covered_help()
                        : projectTasks.length === 0
                          ? m.projects_next()
                          : m.projects_allocation_help()}
                    </p>
                  </div>
                )}
              </section>
              <section className="space-y-4">
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{m.projects_milestones()}</h3>
                    <p className="text-muted-foreground mt-1 max-w-xl text-sm">
                      {m.projects_milestone_help()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setAddingMilestone(true)}
                    disabled={addingMilestone}
                  >
                    <Plus />
                    {m.projects_milestone()}
                  </Button>
                </header>
                {addingMilestone && (
                  <div className="rounded-lg border p-4">
                    <MilestoneForm
                      key={selected._id}
                      projectId={selected._id}
                      onClose={() => setAddingMilestone(false)}
                    />
                  </div>
                )}
                {!milestones.length && !addingMilestone && (
                  <p className="text-muted-foreground rounded-lg border border-dashed p-5 text-sm">
                    {m.projects_no_milestones()}
                  </p>
                )}
                {milestones.map((milestone) => (
                  <section
                    key={milestone._id}
                    className="overflow-hidden rounded-xl border"
                  >
                    <header className="bg-muted/20 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                      <h4 className="flex items-center gap-2 font-medium">
                        <Flag className="size-4" />
                        {milestone.title}
                      </h4>
                      <DrawerButton
                        variant="ghost"
                        size="sm"
                        drawerContent={
                          <TaskCreateDrawer
                            projectId={selected._id}
                            milestoneId={milestone._id}
                          />
                        }
                      >
                        <Plus />
                        {m.plan_task()}
                      </DrawerButton>
                    </header>
                    <ProjectTasks
                      tasks={projectTasks.filter(
                        (t) => t.milestoneId === milestone._id
                      )}
                    />
                  </section>
                ))}
              </section>
              <section className="overflow-hidden rounded-xl border">
                <header className="bg-muted/20 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                  <div>
                    <h3 className="font-semibold">
                      {m.projects_direct_tasks()}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {m.projects_direct_help()}
                    </p>
                  </div>
                  <DrawerButton
                    variant="ghost"
                    size="sm"
                    drawerContent={
                      <TaskCreateDrawer projectId={selected._id} />
                    }
                  >
                    <Plus />
                    {m.plan_task()}
                  </DrawerButton>
                </header>
                <ProjectTasks
                  tasks={projectTasks.filter((t) => !t.milestoneId)}
                />
              </section>
            </div>
          ) : (
            <section className="mx-auto max-w-lg py-12 text-center">
              <FolderKanban className="text-muted-foreground mx-auto mb-4 size-10" />
              <h2 className="text-lg font-semibold">{m.projects_empty()}</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                {m.projects_create_help()}
              </p>
              <DrawerButton
                className="mt-5"
                drawerContent={<ProjectCreateDrawer onCreate={setSelectedId} />}
              >
                <Plus />
                {m.projects_project()}
              </DrawerButton>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function ProjectTasks({
  tasks,
}: {
  tasks: { _id: Id<"tasks">; title: string; effortMinutes?: number }[];
}) {
  return tasks.length ? (
    <ul className="divide-y">
      {tasks.map((task) => (
        <li key={task._id}>
          <DrawerButton
            variant="ghost"
            className="h-auto w-full justify-between rounded-none px-4 py-3 text-left font-normal"
            drawerContent={
              <ErrorSuspense>
                <ProjectTaskEditor taskId={task._id} />
              </ErrorSuspense>
            }
          >
            <span className="min-w-0 truncate">{task.title}</span>
            <span className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
              {task.effortMinutes !== undefined
                ? `${task.effortMinutes} ${m.planning_minutes()}`
                : m.planning_estimate_needed()}
              <ChevronRight className="size-4" />
            </span>
          </DrawerButton>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-muted-foreground p-4 text-sm">{m.projects_no_tasks()}</p>
  );
}

function ProjectTaskEditor({ taskId }: { taskId: Id<"tasks"> }) {
  const { data } = useSuspenseQuery(
    convexQuery(api.tasks.getExtendedById, { taskId })
  );
  return <TaskEditDrawer editedTask={data} />;
}
