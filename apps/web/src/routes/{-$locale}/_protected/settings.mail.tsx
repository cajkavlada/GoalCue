import { createFileRoute } from "@tanstack/react-router";

import { ErrorSuspense } from "@gc/react-kit";

import { MailSettings } from "@/features/mail/mail-settings";

export const Route = createFileRoute("/{-$locale}/_protected/settings/mail")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ErrorSuspense>
      <MailSettings />
    </ErrorSuspense>
  );
}
