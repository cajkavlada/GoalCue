import { Button, ButtonProps } from "../../button";
import { useDrawer } from "./drawer-context";

export function DrawerButton({
  drawerContent,
  ...props
}: { drawerContent: React.ReactNode } & ButtonProps) {
  const { openDrawer } = useDrawer();
  return (
    <Button
      onClick={() => openDrawer(drawerContent)}
      {...props}
    />
  );
}
