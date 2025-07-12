import { useState } from "react";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { api } from "@gc/convex/api";

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

  const { data } = useSuspenseQuery(
    convexQuery(api.names.getNames, { count: 10 })
  );
  const addName = useMutation({
    mutationFn: useConvexMutation(api.names.addName),
  });
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <p className="text-2xl font-bold">{state}</p>
      <button
        className="rounded-md bg-blue-500 p-2 text-white"
        type="button"
        onClick={() => {
          callServer({ data: 1 }).then(() => {
            router.invalidate();
          });
        }}
      >
        Call Server
      </button>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        type="button"
        onClick={() => {
          addName.mutate({ name });
        }}
      >
        Add Name
      </button>
      <div>
        {data.map((name) => (
          <p key={name._id}>{name.name}</p>
        ))}
      </div>
    </div>
  );
}
