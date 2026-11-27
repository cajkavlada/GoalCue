import { createFileRoute, redirect } from "@tanstack/react-router";
import z from "zod";

export const Route = createFileRoute("/{-$locale}/_protected/settings/")({
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
  beforeLoad: ({ search, params }) => {
    throw redirect({
      to:
        search.calendarState !== undefined || search.calendarCode !== undefined
          ? "/{-$locale}/settings/personal-calendars"
          : "/{-$locale}/settings/planning-time",
      params,
      search,
      replace: true,
    });
  },
});
