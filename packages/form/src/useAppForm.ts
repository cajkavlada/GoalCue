import { createFormHook, createFormHookContexts } from "@tanstack/react-form";

import { Input, Select } from "./fieldComponents";
import { FormRoot, SubmitButton } from "./formComponents";

export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { Input, Select },
  formComponents: { FormRoot, SubmitButton },
});
