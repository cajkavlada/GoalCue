import { useEffect } from "react";

import { m } from "@gc/i18n/messages";
import { SubmitStatus } from "@gc/react-kit";
import { cn } from "@gc/utils";

import { Button } from "../../button";
import { StatusSpinner } from "../../status-spinner";
import {
  DrawerContent,
  DrawerContentProps,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  NestedDrawer,
} from "./drawer";
import { useDrawerId, useDrawerInternal } from "./drawer-context";
import { useDrawerContext as useVaulDrawerContext } from "./vaul";

export function Drawer({
  children,
  title,
  description,
  showDescription,
  customFooter,
  onSubmit,
  onCancel,
  cancelLabel,
  submitLabel,
  submitStatus,
  ...props
}: {
  children: React.ReactNode;
  title: string;
  description: string;
  showDescription?: boolean;
  customFooter?: boolean;
  onSubmit?: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
  submitLabel?: string;
  submitStatus?: SubmitStatus;
} & DrawerContentProps) {
  const { activeDrawerCount, drawerContentStack, closeDrawer } =
    useDrawerInternal();
  const { onNestedOpenChange } = useVaulDrawerContext();
  const drawerId = useDrawerId();
  const index = drawerContentStack.findIndex((d) => d.id === drawerId);

  useEffect(() => {
    if (activeDrawerCount === index + 1) {
      onNestedOpenChange(false);
    }
  }, [activeDrawerCount, index, onNestedOpenChange]);
  return (
    <DrawerContent
      className={cn("rounded-l-[10px] p-4", props.className)}
      {...props}
    >
      <DrawerHeader>
        <DrawerTitle>{title}</DrawerTitle>
        {showDescription && (
          <DrawerDescription className={showDescription ? "" : "sr-only"}>
            {description ?? ""}
          </DrawerDescription>
        )}
      </DrawerHeader>
      {children}
      {!customFooter && (
        <Drawer.Footer
          onSubmit={onSubmit}
          onCancel={onCancel}
          cancelLabel={cancelLabel}
          submitLabel={submitLabel}
          submitStatus={submitStatus}
        />
      )}
      <NestedDrawer
        direction="right"
        open={activeDrawerCount > index + 1}
        onOpenChange={closeDrawer}
      >
        {drawerContentStack.length > index + 1 &&
          drawerContentStack[index + 1]?.content}
      </NestedDrawer>
    </DrawerContent>
  );
}

Drawer.Footer = function Footer({
  cancelLabel = m.cancel(),
  submitLabel = m.save(),
  onCancel,
  onSubmit,
  children,
  submitStatus = "idle",
}: {
  cancelLabel?: string;
  submitLabel?: string;
  onCancel?: () => void;
  onSubmit?: () => void;
  children?: React.ReactNode;
  submitStatus?: SubmitStatus;
}) {
  const { closeDrawer } = useDrawerInternal();
  return (
    <DrawerFooter
      className="flex flex-row justify-between p-0 py-4"
      onKeyUp={(e) => {
        if (e.key === "Enter") {
          onSubmit?.();
        }
        if (e.key === "Escape") {
          onCancel?.();
          closeDrawer();
        }
      }}
    >
      <Button
        variant="ghost"
        onClick={() => {
          onCancel?.();
          closeDrawer();
        }}
        data-test-id="cancel-button"
      >
        {cancelLabel}
      </Button>
      {children}
      {submitLabel && onSubmit && (
        <Button
          onClick={onSubmit}
          data-test-id="submit-button"
          disabled={submitStatus === "pending"}
        >
          {submitLabel}
          <StatusSpinner status={submitStatus} />
        </Button>
      )}
    </DrawerFooter>
  );
};
