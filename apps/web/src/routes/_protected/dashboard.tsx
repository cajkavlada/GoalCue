import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div className="border-2 border-gray-300 p-4">Dashboard</div>;
}
