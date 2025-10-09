import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/{-$locale}/_protected/task-types")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Task types</div>;
}
