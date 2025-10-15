import { createContext, useContext, useState } from "react";

import { ErrorSuspense } from "@gc/react-kit";

import { Dialog } from "./dialog";

export const DialogContext = createContext<{
  openDialog: (content: React.ReactNode) => void;
  closeDialog: () => void;
  closeAllDialogs: () => void;
}>({
  openDialog: () => {},
  closeDialog: () => {},
  closeAllDialogs: () => {},
});

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialogStack, setDialogStack] = useState<React.ReactNode[]>([]);

  function openDialog(Content: React.ReactNode) {
    setDialogStack((prev) => [...prev, Content]);
  }

  function closeDialog() {
    setDialogStack((prev) => prev.slice(0, -1));
  }

  function closeAllDialogs() {
    setDialogStack([]);
  }

  const providerValue = {
    openDialog,
    closeDialog,
    closeAllDialogs,
  };

  return (
    <DialogContext value={providerValue}>
      {children}
      {dialogStack.map((dialogContent, index) => {
        return (
          <div
            key={index}
            style={{ zIndex: 70 + index * 10 }}
          >
            <Dialog
              open={!!dialogContent}
              onOpenChange={closeDialog}
            >
              <ErrorSuspense>{dialogContent}</ErrorSuspense>
            </Dialog>
          </div>
        );
      })}
    </DialogContext>
  );
}

export function useDialog() {
  return useContext(DialogContext);
}
