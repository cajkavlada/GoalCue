import { createContext, useContext, useState } from "react";

import { ErrorSuspense } from "@gc/react-kit";

import { MODAL_AFTER_CLOSE_LIFE_TIME } from "../constants";
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
  const [activeDialogCount, setActiveDialogCount] = useState(0);
  const [dialogStack, setDialogStack] = useState<React.ReactNode[]>([]);

  function openDialog(Content: React.ReactNode) {
    setActiveDialogCount((prev) => prev + 1);
    setDialogStack((prev) => [...prev, Content]);
  }

  function closeDialog() {
    setActiveDialogCount((prev) => Math.max(prev - 1, 0));
    setTimeout(() => {
      setDialogStack((prev) => prev.slice(0, -1));
    }, MODAL_AFTER_CLOSE_LIFE_TIME);
  }

  function closeAllDialogs() {
    setActiveDialogCount(0);
    setTimeout(() => {
      setDialogStack([]);
    }, MODAL_AFTER_CLOSE_LIFE_TIME);
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
              open={activeDialogCount > index}
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
