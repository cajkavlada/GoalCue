/// <reference types="vite/client" />
import type { ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";

import { Authenticated, AuthLoading, Unauthenticated } from "@gc/convex";
import { ModeToggle, ThemeProvider } from "@gc/ui";

import { SignIn } from "../components/auth/SignIn";
import { SignOut } from "../components/auth/SignOut";
import { LandingPage } from "../components/Layout/LandingPage";
import appCss from "../styles/app.css?url";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "TanStack Start Starter",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <ThemeProvider
        defaultTheme="dark"
        storageKey="vite-ui-theme"
      >
        <ModeToggle />
        <AuthLoading>Auth Loading ... </AuthLoading>
        <Unauthenticated>
          <SignIn />
          <LandingPage />
        </Unauthenticated>
        <Authenticated>
          <SignOut />
          <Outlet />
        </Authenticated>
      </ThemeProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
