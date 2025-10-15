import { useStore } from "@tanstack/react-form";

import type { SubmitStatus } from "@gc/react-kit";
import { m } from "@gc/i18n/messages";
import { Button, StatusSpinner } from "@gc/ui";

import { useFormContext } from "../use-app-form";
import { useSubmitResponse } from "./use-submit-response";

export function SubmitButton({
  children = m.save(),
  hideSubmitStatus,
}: {
  children?: React.ReactNode;
  hideSubmitStatus?: boolean;
}) {
  const form = useFormContext();

  const [isSubmitting] = useStore(form.store, (state) => [state.isSubmitting]);

  const submitResponse = useSubmitResponse();

  const submitStatus: SubmitStatus = isSubmitting
    ? "pending"
    : submitResponse === "success"
      ? "success"
      : submitResponse === "error"
        ? "error"
        : "idle";

  return (
    <Button
      disabled={isSubmitting}
      type="submit"
    >
      {children}
      {!hideSubmitStatus && <StatusSpinner status={submitStatus} />}
    </Button>
  );
}
