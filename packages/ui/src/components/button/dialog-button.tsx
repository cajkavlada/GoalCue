import { useModal } from "../modal";
import { Button, ButtonProps } from "./button-with-tooltip";

export function DialogButton({
  dialogContent,
  ...props
}: { dialogContent: React.ReactNode } & ButtonProps) {
  const { openDialog } = useModal();
  return (
    <Button
      onClick={() => openDialog(dialogContent)}
      {...props}
    />
  );
}
