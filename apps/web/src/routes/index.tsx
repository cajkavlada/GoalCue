import { useState } from "react";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { api } from "@gc/convex/api";
import { Button, Input } from "@gc/ui";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [name, setName] = useState("");

  const { data } = useSuspenseQuery(
    convexQuery(api.names.getNames, { count: 10 })
  );

  const addName = useMutation({
    mutationFn: useConvexMutation(api.names.addName),
  });

  return (
    <div className="bg-background flex h-screen flex-col items-center justify-center gap-4">
      <div className="flex gap-4">
        <div className="border-2 border-gray-300 p-4">
          <Input
            className="bg-background text-foreground"
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
              <p
                key={name._id}
                className="text-foreground"
              >
                {name.name}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
