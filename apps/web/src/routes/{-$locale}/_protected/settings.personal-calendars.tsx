import { createFileRoute } from "@tanstack/react-router";
import z from "zod";

import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@gc/ui";

import {
  CalendarAuthorization,
  CalendarSources,
} from "@/features/calendar-sources";

export const Route = createFileRoute(
  "/{-$locale}/_protected/settings/personal-calendars"
)({
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
    <Card className="w-full">
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
  );
}
