import { useRef, useState } from "react";
import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { RestrictToElement } from "@dnd-kit/dom/modifiers";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { useStore } from "@tanstack/react-form";
import {
  GripVertical,
  Plus,
  SquareCheckBig,
  SquareDashed,
  X,
} from "lucide-react";
import { nanoid } from "nanoid";
import { ZodError } from "zod";

import { Id } from "@gc/convex/types";
import { useFieldContext } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { Button, InlineEdit, Input, Label, Separator, Tooltip } from "@gc/ui";

type TaskTypeEnumOption = {
  name: string;
  _id?: Id<"taskTypeEnumOptions">;
  dndId: string;
};

export function TaskTypeEnumOptionsEditor({
  onAddEnumOption,
  onRemoveEnumOption,
  onEditEnumOption,
}: {
  onAddEnumOption: (option: TaskTypeEnumOption) => void;
  onRemoveEnumOption: (
    index: number,
    optionId?: Id<"taskTypeEnumOptions">
  ) => void;
  onEditEnumOption: (index: number, value: string) => void;
}) {
  const [newEnumOption, setNewEnumOption] = useState("");
  const droppableRef = useRef<HTMLDivElement>(null);

  const field = useFieldContext<TaskTypeEnumOption[]>();
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
            disabled={newEnumOption.trim() === ""}
            onClick={() => {
              onAddEnumOption({ name: newEnumOption, dndId: nanoid() });
              setNewEnumOption("");
              field.handleBlur();
            }}
          >
            <Plus />
          </Button>
        </div>
        {field.state.value.length > 0 && (
          <>
            <Separator className="my-2" />
            <div ref={droppableRef}>
              <DragDropProvider
                onDragEnd={(event) => {
                  if (isSortable(event.operation.source)) {
                    const sortable = event.operation.source.sortable;
                    field.moveValue(sortable.initialIndex, sortable.index);
                  }
                }}
              >
                <ol className="flex flex-col gap-2">
                  {field.state.value.map((option, index) => (
                    <SortableEnumOption
                      key={option.dndId}
                      index={index}
                      option={option}
                      onEditEnumOption={onEditEnumOption}
                      onRemoveEnumOption={(index, optionId) => {
                        onRemoveEnumOption(index, optionId);
                        field.handleBlur();
                      }}
                      optionsCount={field.state.value.length}
                      droppableRef={droppableRef}
                    />
                  ))}
                </ol>
              </DragDropProvider>
            </div>
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

function SortableEnumOption({
  index,
  option,
  onEditEnumOption,
  onRemoveEnumOption,
  optionsCount,
  droppableRef,
}: {
  index: number;
  option: TaskTypeEnumOption;
  onEditEnumOption: (index: number, value: string) => void;
  onRemoveEnumOption: (
    index: number,
    optionId?: Id<"taskTypeEnumOptions">
  ) => void;
  optionsCount: number;
  droppableRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { ref, handleRef } = useSortable({
    id: option.dndId,
    index,
    transition: { idle: true },
    modifiers: [
      RestrictToVerticalAxis,
      RestrictToElement.configure({ element: droppableRef.current }),
    ],
  });

  return (
    <li
      ref={ref}
      className="flex items-center gap-2 pl-1"
    >
      <div
        ref={handleRef}
        className="cursor-grab"
      >
        <GripVertical />
      </div>
      <InlineEdit
        className="mr-auto flex-1 truncate"
        defaultValue={option.name}
        saveOnBlur
        onSave={(value) => {
          onEditEnumOption(index, value);
        }}
      />
      {index === 0 && optionsCount > 1 && (
        <Tooltip content={m.taskTypes_form_field_enumOptions_initial_tooltip()}>
          <SquareDashed className="text-muted-foreground" />
        </Tooltip>
      )}
      {index === optionsCount - 1 && optionsCount > 1 && (
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
        onClick={() => onRemoveEnumOption(index, option._id)}
      >
        <X />
      </Button>
    </li>
  );
}
