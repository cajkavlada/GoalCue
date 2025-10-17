import { Label, Switch } from "@gc/ui";
import { cn } from "@gc/utils";

import { useFieldContext } from "../use-app-form";

export function SwitchField({
  label,
  className,
  ...switchProps
}: {
  label: string;
  className?: string;
} & React.ComponentProps<"button">) {
  const field = useFieldContext<boolean>();
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Label htmlFor={field.name}>{label}</Label>
      <Switch
        {...switchProps}
        checked={field.state.value}
        onCheckedChange={field.handleChange}
      />
    </div>
  );
}
