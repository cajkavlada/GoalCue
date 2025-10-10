import { UseMutationResult } from "@tanstack/react-query";

import { m } from "@gc/i18n/messages";

import { Button } from "../button";
import {
  DialogContent,
  DialogContentProps,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { useDialog } from "./use-dialog";

type SubmitStatus = UseMutationResult<
  unknown,
  unknown,
  unknown,
  unknown
>["status"];

export function Dialog({
  children,
  title,
  description,
  className,
  onInteractOutside,
  customFooter,
  showDescription,
  onSubmit,
  onCancel,
  cancelLabel,
  submitLabel,
  submitStatus,
  ...props
}: {
  children?: React.ReactNode;
  title?: string;
  description: string;
  onSubmit?: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
  submitLabel?: string;
  submitStatus?: SubmitStatus;
  onInteractOutside?: () => void;
  className?: string;
  customFooter?: boolean;
  showDescription?: boolean;
} & DialogContentProps) {
  return (
    <DialogContent
      className={className}
      onInteractOutside={onInteractOutside}
      {...props}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && (
          <DialogDescription className={showDescription ? "" : "sr-only"}>
            {description ?? ""}
          </DialogDescription>
        )}
      </DialogHeader>
      {children}
      {!customFooter && (
        <Dialog.Footer
          onSubmit={onSubmit}
          onCancel={onCancel}
          cancelLabel={cancelLabel}
          submitLabel={submitLabel}
          submitStatus={submitStatus}
        />
      )}
    </DialogContent>
  );
}

Dialog.Footer = function Footer({
  cancelLabel = m.cancel(),
  submitLabel = m.save(),
  onCancel,
  onSubmit,
  children,
  submitStatus,
}: {
  cancelLabel?: string;
  submitLabel?: string;
  onCancel?: () => void;
  onSubmit?: () => void;
  children?: React.ReactNode;
  submitStatus?: SubmitStatus;
}) {
  const { closeDialog } = useDialog();

  return (
    <DialogFooter
      className="mt-8 p-2 sm:justify-between"
      onKeyUp={(e) => {
        if (e.key === "Enter") {
          onSubmit?.();
        }
        if (e.key === "Escape") {
          onCancel?.();
          closeDialog();
        }
      }}
    >
      {cancelLabel && (
        <Button
          variant="ghost"
          onClick={() => {
            onCancel?.();
            closeDialog();
          }}
          data-test-id="cancel-button"
        >
          {cancelLabel}
        </Button>
      )}
      {children}
      {submitLabel && onSubmit && (
        <Button
          onClick={onSubmit}
          data-test-id="submit-button"
          disabled={submitStatus === "pending"}
        >
          {submitLabel}
          {submitStatus === "pending" && "spinner"}
          {submitStatus === "success" && "success"}
          {submitStatus === "error" && "error"}
        </Button>
      )}
    </DialogFooter>
  );
};
