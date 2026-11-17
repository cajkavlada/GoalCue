import { createFileRoute } from "@tanstack/react-router";
import z from "zod";

import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@gc/ui";

import {
  CalendarAuthorization,
  CalendarSources,
} from "@/features/calendar-sources";
import { MailSettings } from "@/features/mail/mail-settings";
import { PriorityClassCard } from "@/features/priority-classes/priority-class-card";
import { TagCard } from "@/features/tags/tag-card";
import { TaskTypeCard } from "@/features/task-types/task-type-card";
import { JiraImport } from "@/features/tasks/jira-import";
import { PlanningTimeSettings } from "@/features/tasks/schedule-constraints";
import { UnitCard } from "@/features/units/unit-card";
import { WorkCalendars } from "@/features/work-calendars";

export const Route = createFileRoute("/{-$locale}/_protected/settings")({
  validateSearch: (
    search: Record<string, unknown>
  ): { calendarState?: string; calendarCode?: string } => ({
    calendarState: z
      .string()
      .max(128)
      .optional()
      .catch(undefined)
      .parse(search.calendarState),
    calendarCode: z
      .string()
      .max(4096)
      .optional()
      .catch(undefined)
      .parse(search.calendarCode),
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { calendarState, calendarCode } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      <ErrorSuspense>
        <MailSettings />
      </ErrorSuspense>
      <Card className="mx-auto w-full max-w-xl shrink-0">
        <CardHeader>
          <CardTitle>{m.calendar_personal_calendars()}</CardTitle>
        </CardHeader>
        <CardContent>
          <CalendarAuthorization
            state={calendarState}
            code={calendarCode}
            onComplete={() => {
              void navigate({ search: {}, replace: true });
            }}
          />
          <ErrorSuspense>
            <CalendarSources />
          </ErrorSuspense>
        </CardContent>
      </Card>
      <Card className="mx-auto w-full max-w-xl shrink-0">
        <CardHeader>
          <CardTitle>{m.constraints_planning_time()}</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorSuspense>
            <PlanningTimeSettings />
          </ErrorSuspense>
        </CardContent>
      </Card>
      <Card className="mx-auto w-full max-w-xl shrink-0">
        <CardHeader>
          <CardTitle>{m.jira_title()}</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorSuspense>
            <JiraImport />
          </ErrorSuspense>
        </CardContent>
      </Card>
      <ErrorSuspense>
        <WorkCalendars />
      </ErrorSuspense>
      <div className="flex min-h-96 shrink-0 flex-wrap justify-center gap-4">
        <TaskTypeCard />
        <UnitCard />
        <PriorityClassCard />
        <TagCard />
      </div>
    </div>
  );
}
