import { useModal } from "../modal";
import { Button, ButtonProps } from "./button-with-tooltip";

export function DrawerButton({
  drawerContent,
  ...props
}: { drawerContent: React.ReactNode } & ButtonProps) {
  const { openDrawer } = useModal();

  return (
    <Button
      onClick={() => openDrawer(drawerContent)}
      type="button"
      {...props}
    />
  );
}
