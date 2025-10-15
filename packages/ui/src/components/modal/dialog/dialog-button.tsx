import { Button, ButtonProps } from "../../button";
import { useDialog } from "./dialog-context";

export function DialogButton({
  dialogContent,
  ...props
}: { dialogContent: React.ReactNode } & ButtonProps) {
  const { openDialog } = useDialog();
  return (
    <Button
      onClick={() => openDialog(dialogContent)}
      {...props}
    />
  );
}
