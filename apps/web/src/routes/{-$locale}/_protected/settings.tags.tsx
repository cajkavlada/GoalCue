import { createFileRoute } from "@tanstack/react-router";

import { ErrorSuspense } from "@gc/react-kit";

import { TagCard } from "@/features/tags/tag-card";

export const Route = createFileRoute("/{-$locale}/_protected/settings/tags")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ErrorSuspense>
      <TagCard />
    </ErrorSuspense>
  );
}
