import { Button } from "../button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { useDialog } from "./use-dialog";

export function Dialog({
  children,
  title,
  description,
  className,
  onInteractOutside,
  customFooter,
  ...props
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
  onSubmit?: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
  submitLabel?: string;
  onInteractOutside?: () => void;
  className?: string;
  customFooter?: boolean;
}) {
  return (
    <DialogContent
      className={className}
      onInteractOutside={onInteractOutside}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && (
          <DialogDescription>{description ?? ""}</DialogDescription>
        )}
      </DialogHeader>
      {children}
      {!customFooter && <Dialog.Footer {...props} />}
    </DialogContent>
  );
}

Dialog.Footer = function Footer({
  cancelLabel = "Cancel",
  submitLabel = "Save",
  onCancel,
  onSubmit,
  children,
}: {
  cancelLabel?: string;
  submitLabel?: string;
  onCancel?: () => void;
  onSubmit?: () => void;
  children?: React.ReactNode;
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
        >
          {submitLabel}
        </Button>
      )}
    </DialogFooter>
  );
};
