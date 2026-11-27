import { createFileRoute } from "@tanstack/react-router";

import { m } from "@gc/i18n/messages";
import { ErrorSuspense } from "@gc/react-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@gc/ui";

import { JiraImport } from "@/features/tasks/jira-import";

export const Route = createFileRoute(
  "/{-$locale}/_protected/settings/jira-import"
)({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{m.jira_title()}</CardTitle>
      </CardHeader>
      <CardContent>
        <ErrorSuspense>
          <JiraImport />
        </ErrorSuspense>
      </CardContent>
    </Card>
  );
}
