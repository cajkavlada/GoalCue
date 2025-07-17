import { useEffect, useState } from "react";
import { useStore } from "@tanstack/react-form";

import { useFormContext } from "../useAppForm";

export function useSubmitResponse() {
  const [submitted, setSubmitted] = useState(false);
  const [submitResponse, setSubmitResponse] = useState<
    "success" | "error" | null
  >(null);

  const form = useFormContext();
  const [isSubmitting, isSubmitSuccessful, isDirty] = useStore(
    form.store,
    (state) => [state.isSubmitting, state.isSubmitSuccessful, state.isDirty]
  );

  useEffect(() => {
    if (isSubmitting && isDirty) {
      setSubmitResponse(null);
      setSubmitted(true);
    } else if (submitted) {
      setSubmitResponse(isSubmitSuccessful ? "success" : "error");
    }
  }, [submitted, isSubmitting, isSubmitSuccessful, isDirty]);

  useEffect(() => {
    if (submitResponse === "success" || submitResponse === "error") {
      const timeout = setTimeout(() => {
        setSubmitResponse(null);
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [submitResponse]);

  return submitResponse;
}
