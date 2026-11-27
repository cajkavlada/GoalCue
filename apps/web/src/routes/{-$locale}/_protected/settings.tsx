import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import {
  Calendar,
  CalendarDays,
  Clock3,
  Flag,
  Import,
  ListTodo,
  Mail,
  Ruler,
  Tags,
} from "lucide-react";

import { m } from "@gc/i18n/messages";
import { Button } from "@gc/ui";

export const Route = createFileRoute("/{-$locale}/_protected/settings")({
  component: RouteComponent,
});

function RouteComponent() {
  const groups = [
    {
      label: m.settings_planning(),
      links: [
        {
          to: "/{-$locale}/settings/planning-time",
          label: m.constraints_planning_time(),
          icon: Clock3,
        },
        {
          to: "/{-$locale}/settings/work-calendars",
          label: m.work_calendar_title(),
          icon: CalendarDays,
        },
      ],
    },
    {
      label: m.settings_connections(),
      links: [
        {
          to: "/{-$locale}/settings/personal-calendars",
          label: m.calendar_personal_calendars(),
          icon: Calendar,
        },
        { to: "/{-$locale}/settings/mail", label: m.mail_title(), icon: Mail },
        {
          to: "/{-$locale}/settings/jira-import",
          label: m.jira_title(),
          icon: Import,
        },
      ],
    },
    {
      label: m.settings_organization(),
      links: [
        {
          to: "/{-$locale}/settings/task-types",
          label: m.taskTypes_heading(),
          icon: ListTodo,
        },
        {
          to: "/{-$locale}/settings/units",
          label: m.units_heading(),
          icon: Ruler,
        },
        {
          to: "/{-$locale}/settings/priority-classes",
          label: m.priorityClasses_heading(),
          icon: Flag,
        },
        {
          to: "/{-$locale}/settings/tags",
          label: m.tags_heading(),
          icon: Tags,
        },
      ],
    },
  ] as const;
  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 p-4 md:flex-row md:gap-8 md:p-8">
        <aside className="shrink-0 md:sticky md:top-8 md:w-56 md:self-start">
          <h1 className="text-2xl font-semibold tracking-tight">
            {m.nav_settings()}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {m.settings_description()}
          </p>
          <nav
            aria-label={m.nav_settings()}
            className="mt-6 space-y-5"
          >
            {groups.map((group) => (
              <div key={group.label}>
                <h2 className="text-muted-foreground mb-2 px-3 text-xs font-semibold uppercase tracking-wider">
                  {group.label}
                </h2>
                <div className="flex flex-wrap gap-1 md:flex-col">
                  {group.links.map(({ to, label, icon: Icon }) => (
                    <Button
                      key={to}
                      variant="ghost"
                      asChild
                      className="justify-start md:w-full"
                    >
                      <Link
                        to={to}
                        activeOptions={{ includeSearch: false }}
                        activeProps={{
                          className: "bg-accent text-accent-foreground",
                          "aria-current": "page",
                        }}
                      >
                        <Icon aria-hidden="true" />
                        {label}
                      </Link>
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
