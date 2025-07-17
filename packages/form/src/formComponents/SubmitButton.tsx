import { useStore } from "@tanstack/react-form";

import { Button } from "@gc/ui";

// import { CheckmarkCircleRegular, DismissCircleRegular } from "@nnlib/ui/icons";

import { useFormContext } from "../useAppForm";
import { useSubmitResponse } from "./useSubmitResponse";

export function SubmitButton({
  children,
  showSubmitResponse,
}: {
  children: React.ReactNode;
  showSubmitResponse?: boolean;
}) {
  const form = useFormContext();

  const [isSubmitting] = useStore(form.store, (state) => [state.isSubmitting]);

  const submitResponse = useSubmitResponse();

  return (
    <Button
      className="w-full gap-4"
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
