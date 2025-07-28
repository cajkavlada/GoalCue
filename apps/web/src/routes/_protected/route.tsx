import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { api } from "@gc/convex/api";

export const Route = createFileRoute("/_protected")({
  beforeLoad: async ({ context: { userId, convexClient } }) => {
    if (!userId) {
      throw redirect({ to: "/" });
    }
    const userExists = await convexClient.query(api.users.userExists, {
      userId,
    });
    if (!userExists) {
      await convexClient.mutation(api.users.initUser, { userId });
    }
  },
  component: Outlet,
});
