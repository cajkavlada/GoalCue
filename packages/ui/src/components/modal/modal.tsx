import { DialogProvider, useDialog } from "./dialog";
import { DrawerProvider, useDrawer } from "./drawer";

export function ModalProvider({ children }: { children: React.ReactNode }) {
  return (
    <DialogProvider>
      <DrawerProvider>{children}</DrawerProvider>
    </DialogProvider>
  );
}

export function useModal() {
  const drawer = useDrawer();
  const dialog = useDialog();

  return { ...drawer, ...dialog };
}
