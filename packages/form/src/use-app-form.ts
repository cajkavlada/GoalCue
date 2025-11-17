import { createFormHook, createFormHookContexts } from "@tanstack/react-form";

import {
  ColorPickerField,
  DatePickerField,
  InputField,
  MultiSelectField,
  SelectField,
  SwitchField,
} from "./field-components";
import { FormErrors, FormRoot, SubmitButton } from "./form-components";

export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    Input: InputField,
    Select: SelectField,
    DatePicker: DatePickerField,
    Switch: SwitchField,
    MultiSelect: MultiSelectField,
    ColorPicker: ColorPickerField,
  },
  formComponents: { FormRoot, SubmitButton, FormErrors },
});
