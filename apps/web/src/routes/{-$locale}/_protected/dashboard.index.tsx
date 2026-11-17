import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/{-$locale}/_protected/dashboard/")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/{-$locale}/dashboard/day", search, replace: true });
  },
});
