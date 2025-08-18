import { useStore } from "@tanstack/react-form";

import { m } from "@gc/i18n/messages";
import { Button } from "@gc/ui";

// import { CheckmarkCircleRegular, DismissCircleRegular } from "@nnlib/ui/icons";

import { useFormContext } from "../useAppForm";
import { useSubmitResponse } from "./useSubmitResponse";

export function SubmitButton({
  children = m.save(),
  showSubmitResponse,
}: {
  children?: React.ReactNode;
  showSubmitResponse?: boolean;
}) {
  const form = useFormContext();

  const [isSubmitting] = useStore(form.store, (state) => [state.isSubmitting]);

  const submitResponse = useSubmitResponse();

  return (
    <Button
      disabled={isSubmitting}
      type="submit"
    >
      {children}
      {isSubmitting && "spinner"}
      {
        showSubmitResponse && submitResponse === "success" && "success"
        // <CheckmarkCircleRegular
        //   color="green"
        //   fontSize={20}
        // />
      }
      {
        showSubmitResponse && submitResponse === "error" && "dismiss"
        // <DismissCircleRegular
        //   color="red"
        //   fontSize={20}
        // />
      }
    </Button>
  );
}
