import { useRef, useState } from "react";

import { cn } from "@gc/utils";

import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip-primitives";

export function TruncateWithTooltip({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <Tooltip open={showTooltip}>
      <TooltipTrigger asChild>
        <span
          ref={ref}
          onMouseEnter={() =>
            setShowTooltip(
              ref.current
                ? ref.current.scrollWidth > ref.current.clientWidth
                : false
            )
          }
          onMouseLeave={() => setShowTooltip(false)}
          className={cn("block truncate", className)}
        >
          {text}
        </span>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}
