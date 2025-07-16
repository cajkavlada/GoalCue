import { useState } from "react";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { api } from "@gc/convex/api";
import { Button, Input } from "@gc/ui";

const getServerValue = createServerFn({
  method: "GET",
}).handler(() => {
  return "server value";
});

const callServer = createServerFn({ method: "POST" })
  .validator((d: number) => d)
  .handler(async ({ data }) => {
    console.log("calling server", data);
    return "server call" + data;
  });

export const Route = createFileRoute("/")({
  component: Home,
  loader: async () => await getServerValue(),
});

function Home() {
  const router = useRouter();
  const state = Route.useLoaderData();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  const { data } = useSuspenseQuery(
    convexQuery(api.names.getNames, { count: 10 })
  );
  const { data: notes } = useSuspenseQuery(
    convexQuery(api.userNotes.getMyNotes, { count: 10 })
  );
  const addName = useMutation({
    mutationFn: useConvexMutation(api.names.addName),
  });
  const addNote = useMutation({
    mutationFn: useConvexMutation(api.userNotes.addMyNote),
  });
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <p className="text-2xl font-bold">{state}</p>
      <Button
        type="button"
        onClick={() => {
          callServer({ data: 1 }).then(() => {
            router.invalidate();
          });
        }}
      >
        Call Server
      </Button>
      <div className="flex gap-4">
        <div className="border-2 border-gray-300 p-4">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            type="button"
            onClick={() => {
              addName.mutate({ name });
            }}
          >
            Add Name
          </Button>
          <div>
            {data.map((name) => (
              <p key={name._id}>{name.name}</p>
            ))}
          </div>
        </div>
        <div className="border-2 border-gray-300 p-4">
          <Input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            type="button"
            onClick={() => {
              addNote.mutate({ note });
            }}
          >
            Add Note
          </Button>
          <div>
            {notes.map((note) => (
              <p key={note._id}>{note.note}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
