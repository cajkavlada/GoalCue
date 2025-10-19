import {
  TooltipContent,
  TooltipTrigger,
  Tooltip as UITooltip,
} from "./tooltip-primitives";

export function Tooltip({
  content,
  children,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <UITooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </UITooltip>
  );
}
