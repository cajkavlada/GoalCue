import z from "zod";

import { m } from "@gc/i18n/messages";
import { CUSTOM_ERROR_REASONS } from "@gc/validators";

export function configureGlobalZodErrorMap() {
  z.config({
    customError: (issue) => {
      if (
        issue.code === "too_small" &&
        issue.origin === "string" &&
        issue.minimum === 1
      ) {
        return m.form_field_validation_string_not_empty();
      }
      if (issue.code === "invalid_type" && issue.expected === "number") {
        return m.form_field_validation_number();
      }
      if (issue.code === "too_small" && issue.origin === "array") {
        return m.form_field_validation_array_min({ min: issue.minimum });
      }
      if (issue.code === "custom") {
        return customErrorMap(issue);
      }
      return undefined;
    },
  });
}

function customErrorMap(issue: z.core.$ZodRawIssue) {
  if (issue.code !== "custom") {
    return undefined;
  }
  switch (issue.params?.reason) {
    case CUSTOM_ERROR_REASONS.EQUAL_INITIAL_AND_COMPLETED_NUM_VALUES:
      return m.tasks_form_field_initialCompletedNumValue_validation_equal();
    // case CUSTOM_ERROR_REASONS.EQUAL_INITIAL_AND_COMPLETED_ENUM_OPTIONS:
    //   return m.taskTypes_form_field_initialCompletedEnumOption_validation_equal();
    // case CUSTOM_ERROR_REASONS.INITIAL_ENUM_OPTION_NOT_FOUND:
    //   return m.taskTypes_form_field_initialEnumOption_validation_not_found();
    // case CUSTOM_ERROR_REASONS.COMPLETED_ENUM_OPTION_NOT_FOUND:
    //   return m.taskTypes_form_field_completedEnumOption_validation_not_found();
    case CUSTOM_ERROR_REASONS.NOT_UNIQUE:
      return m.form_field_validation_not_unique();
    default:
      return undefined;
  }
}
