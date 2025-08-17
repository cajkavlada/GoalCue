/// <reference types="vite/client" />
import type { ReactNode } from "react";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouteContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { getWebRequest } from "@tanstack/react-start/server";

import {
  ClerkLoaded,
  ClerkLoading,
  ClerkProvider,
  getAuth,
  SignedIn,
  SignedOut,
  SignInButton,
  useAuth,
  UserButton,
} from "@gc/auth";
import { ConvexProviderWithClerk, ConvexReactClient } from "@gc/convex";
import { ErrorSuspense } from "@gc/react-kit";
import { ModeToggle, ThemeProvider } from "@gc/ui";

import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { clerkLocalizations } from "@/utils/clerkLocalizations";
import appCss from "../styles/app.css?url";

const fetchClerkAuth = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getAuth(getWebRequest());
  const token = await auth.getToken({ template: "convex" });

  return {
    userId: auth.userId,
    token,
  };
});

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexClient: ConvexReactClient;
  convexQueryClient: ConvexQueryClient;
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
        title: "GoalCue",
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
  beforeLoad: async (ctx) => {
    const auth = await fetchClerkAuth();

    const { userId, token } = auth;

    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
    }

    return {
      userId,
      token,
    };
  },
  component: RootComponent,
});

function RootComponent() {
  const context = useRouteContext({ from: Route.id });
  const locale = getLocale();
  const clerkLocalization = clerkLocalizations[locale] || clerkLocalizations.en;

  return (
    <ClerkProvider localization={clerkLocalization}>
      <ConvexProviderWithClerk
        client={context.convexClient}
        useAuth={useAuth}
      >
        <ThemeProvider
          defaultTheme="dark"
          storageKey="vite-ui-theme"
        >
          <RootDocument>
            <ErrorSuspense>
              <Outlet />
            </ErrorSuspense>
          </RootDocument>
        </ThemeProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <div>
          <div>
            <ModeToggle />
            <ClerkLoading>{m.auth_loading()}</ClerkLoading>
            <ClerkLoaded>
              <SignedIn>
                <UserButton />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  {m.auth_signIn_button_label()}
                </SignInButton>
              </SignedOut>
            </ClerkLoaded>
          </div>
          {children}
        </div>
        <TanStackRouterDevtools />
        <ReactQueryDevtools initialIsOpen={false} />
        <Scripts />
      </body>
    </html>
  );
}
