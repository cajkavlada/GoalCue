import { createFormHook, createFormHookContexts } from "@tanstack/react-form";

import { Input } from "./fieldComponents";
import { FormRoot, SubmitButton } from "./formComponents";

export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();

export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { Input },
  formComponents: { FormRoot, SubmitButton },
});
