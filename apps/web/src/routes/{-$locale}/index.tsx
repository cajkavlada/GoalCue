import { createFileRoute, redirect } from "@tanstack/react-router";

import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/{-$locale}/")({
  beforeLoad: async ({ context: { userId, token } }) => {
    if (userId && token) {
      throw redirect({ to: "/{-$locale}/dashboard" });
    }
  },
  component: Home,
});

function Home() {
  return (
    <div className="bg-background flex h-screen flex-col items-center justify-center gap-4">
      <div className="flex gap-4">
        <div className="border-2 border-gray-300 p-4">{m.landing_greet()}</div>
      </div>
    </div>
  );
}
