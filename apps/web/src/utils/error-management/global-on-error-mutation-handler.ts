import { ConvexError } from "@gc/convex";
import { m } from "@gc/i18n/messages";
import { toast } from "@gc/ui";

export function globalOnErrorMutationHandler(error: Error) {
  if (error instanceof ConvexError) {
    if (error.data.code === "zod_error") {
      toast.error(m.toast_error_validation(), {
        description: error.data.message,
      });
    } else {
      toast.error(m.toast_generic_error(), {
        description: error.data.message,
      });
    }
  } else {
    toast.error(m.toast_error_unexpected(), {
      description: error.message,
    });
  }
}
