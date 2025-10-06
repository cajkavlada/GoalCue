import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { api } from "@gc/convex/api";

export const Route = createFileRoute("/{-$locale}/_protected")({
  beforeLoad: async ({ context: { auth, convexClient } }) => {
    if (!auth.isSignedIn) {
      throw redirect({ to: "/{-$locale}" });
    }
    const userExists = await convexClient.query(api.users.userExists, {
      userId: auth.userId,
    });
    if (!userExists) {
      await convexClient.mutation(api.users.initUser, { userId: auth.userId });
    }
  },
  component: Outlet,
});
