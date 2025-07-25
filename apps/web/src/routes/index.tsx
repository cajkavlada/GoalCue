import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="bg-background flex h-screen flex-col items-center justify-center gap-4">
      <div className="flex gap-4">
        <div className="border-2 border-gray-300 p-4">Hello</div>
      </div>
    </div>
  );
}
