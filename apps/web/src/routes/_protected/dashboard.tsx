import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { api } from "@gc/convex/api";
import { useAppForm } from "@gc/form";

export const Route = createFileRoute("/_protected/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { data: notes } = useSuspenseQuery(
    convexQuery(api.userNotes.getMyNotes, { count: 10 })
  );
  const addNote = useMutation({
    mutationFn: useConvexMutation(api.userNotes.addMyNote),
  });

  const form = useAppForm({
    defaultValues: {
      note: "",
    },
    onSubmit: ({ value }) => {
      addNote.mutate(value);
    },
  });
  return (
    <div className="border-2 border-gray-300 p-4">
      <form.AppForm>
        <form.FormRoot>
          <form.AppField name="note">
            {(field) => <field.Input label="Note" />}
          </form.AppField>
          <form.SubmitButton showSubmitResponse>Add note</form.SubmitButton>
        </form.FormRoot>
      </form.AppForm>
      <div>
        {notes.map((note) => (
          <p
            key={note._id}
            className="text-foreground"
          >
            {note.note}
          </p>
        ))}
      </div>
    </div>
  );
}
