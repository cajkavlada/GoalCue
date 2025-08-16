import { createContext, useCallback, useMemo, useState } from "react";

import { Dialog } from "./dialog";

export const DialogContext = createContext<{
  openDialog: (content: React.ReactNode) => void;
  closeDialog: () => void;
  closeAllDialogs: () => void;
  isDialogOpen: boolean;
}>({
  openDialog: () => {},
  closeDialog: () => {},
  closeAllDialogs: () => {},
  isDialogOpen: false,
});

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialogStack, setDialogStack] = useState<React.ReactNode[]>([]);

  const openDialog = useCallback((Content: React.ReactNode) => {
    setDialogStack((prev) => [...prev, Content]);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogStack((prev) => prev.slice(0, -1));
  }, []);

  const closeAllDialogs = useCallback(() => {
    setDialogStack([]);
  }, []);

  const providerValue = useMemo(
    () => ({
      openDialog,
      closeDialog,
      closeAllDialogs,
      isDialogOpen: dialogStack.length > 0,
    }),
    [openDialog, closeDialog, closeAllDialogs, dialogStack.length]
  );

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
              {dialogContent}
            </Dialog>
          </div>
        );
      })}
    </DialogContext>
  );
}
