import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

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
    </div>
  );
}
