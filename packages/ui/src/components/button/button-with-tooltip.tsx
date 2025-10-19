import { Tooltip } from "../tooltip";
import { Button as BaseButton, ButtonProps as BaseButtonProps } from "./button";

export type ButtonProps = {
  tooltip?: string;
} & BaseButtonProps;

export function Button({ tooltip, ...props }: ButtonProps) {
  if (!tooltip) {
    return <BaseButton {...props} />;
  }
  return (
    <Tooltip content={tooltip}>
      <BaseButton {...props} />
    </Tooltip>
  );
}
