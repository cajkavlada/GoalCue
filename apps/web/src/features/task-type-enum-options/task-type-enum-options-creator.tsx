import { useState } from "react";
import { useStore } from "@tanstack/react-form";
import { Plus, SquareCheckBig, SquareDashed, X } from "lucide-react";
import { ZodError } from "zod";

import { useFieldContext } from "@gc/form";
import { m } from "@gc/i18n/messages";
import {
  Button,
  Input,
  Label,
  Separator,
  Tooltip,
  TruncateWithTooltip,
} from "@gc/ui";

export function TaskTypeEnumOptionsCreator({
  enumOptions,
  onAddEnumOption,
  onRemoveEnumOption,
}: {
  enumOptions: string[];
  onAddEnumOption: (option: string) => void;
  onRemoveEnumOption: (index: number) => void;
}) {
  const [newEnumOption, setNewEnumOption] = useState("");
  const field = useFieldContext<string[]>();
  const errors = useStore(field.store, (state) => state.meta.errors);
  return (
    <div>
      <Label>{m.taskTypes_form_field_enumOptions_label()}</Label>
      <div className="rounded-md border p-2">
        <div className="flex gap-2">
          <Input
            value={newEnumOption}
            placeholder={m.taskTypes_form_field_enumOptions_new_placeholder()}
            onChange={(e) => setNewEnumOption(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={
              newEnumOption.trim() === "" || enumOptions.includes(newEnumOption)
            }
            onClick={() => {
              onAddEnumOption(newEnumOption);
              setNewEnumOption("");
              field.handleBlur();
            }}
          >
            <Plus />
          </Button>
        </div>
        {enumOptions.length > 0 && (
          <>
            <Separator className="my-2" />
            <ol className="flex flex-col gap-2">
              {enumOptions.map((option, index) => (
                <li
                  key={index}
                  className="flex items-center gap-2 pl-1"
                >
                  <TruncateWithTooltip
                    text={option}
                    className="mr-auto"
                  />
                  {index === 0 && enumOptions.length > 1 && (
                    <Tooltip
                      content={m.taskTypes_form_field_enumOptions_initial_tooltip()}
                    >
                      <SquareDashed className="text-muted-foreground" />
                    </Tooltip>
                  )}
                  {index === enumOptions.length - 1 &&
                    enumOptions.length > 1 && (
                      <Tooltip
                        content={m.taskTypes_form_field_enumOptions_completed_tooltip()}
                      >
                        <SquareCheckBig className="text-muted-foreground" />
                      </Tooltip>
                    )}
                  <Button
                    className="size-7"
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      onRemoveEnumOption(index);
                      field.handleBlur();
                    }}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
      {errors.map((error: ZodError | string, index) => (
        <p
          key={index}
          className="text-sm text-red-500"
        >
          {typeof error === "string"
            ? error
            : error?.message || "Unknown error"}
        </p>
      ))}
    </div>
  );
}
