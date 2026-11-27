import { createFileRoute } from "@tanstack/react-router";

import { ErrorSuspense } from "@gc/react-kit";

import { UnitCard } from "@/features/units/unit-card";

export const Route = createFileRoute("/{-$locale}/_protected/settings/units")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ErrorSuspense>
      <UnitCard />
    </ErrorSuspense>
  );
}
