import { Button } from "../button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../dialog";
import { useDialog } from "./use-dialog";

export function DialogLayout({
  children,
  title,
  description,
  cancelLabel,
  submitLabel,
  onSubmit,
  onCancel,
  className,
  onInteractOutside,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
  cancelLabel?: string;
  submitLabel?: string;
  onSubmit?: () => void;
  onCancel?: () => void;
  onInteractOutside?: () => void;
  className?: string;
}) {
  const { closeDialog } = useDialog();

  return (
    <DialogContent
      className={className}
      onInteractOutside={onInteractOutside}
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
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && (
          <DialogDescription>{description ?? ""}</DialogDescription>
        )}
      </DialogHeader>
      {children}
      <DialogFooter className="mt-8 p-2 sm:justify-between">
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
        {submitLabel && onSubmit && (
          <Button
            onClick={onSubmit}
            data-test-id="submit-button"
          >
            {submitLabel}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
