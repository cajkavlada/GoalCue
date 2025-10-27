import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRouter,
  ErrorComponent,
  RouterProvider,
} from "@tanstack/react-router";

import { ClerkLoaded, ClerkLoading, ClerkProvider, useAuth } from "@gc/auth";
import {
  ConvexError,
  ConvexProviderWithClerk,
  ConvexReactClient,
} from "@gc/convex";
import { m } from "@gc/i18n/messages";
import { getLocale } from "@gc/i18n/runtime";
import { ErrorBoundary, ErrorSuspense } from "@gc/react-kit";
import { ThemeProvider, toast } from "@gc/ui";

import { NotFoundRoute } from "./components/NotFoundRoute";
import { env } from "./env";
import { routeTree } from "./routeTree.gen";
import { clerkLocalizations } from "./utils/clerk-localizations";
import { configureGlobalZodErrorMap } from "./utils/global-zod-error-map";

configureGlobalZodErrorMap();

const convex = new ConvexReactClient(env.VITE_CONVEX_URL);
const convexQueryClient = new ConvexQueryClient(convex);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryKeyHashFn: convexQueryClient.hashFn(),
      queryFn: convexQueryClient.queryFn(),
    },
    mutations: {
      onError: (error) => {
        if (error instanceof ConvexError) {
          if (error.data.code === "zod_error") {
            toast.error(m.toast_error_validation(), {
              description: error.data.message,
            });
          } else {
            toast.error(m.toast_generic_error(), {
              description: error.data.message,
            });
          }
        } else {
          toast.error(m.toast_error_unexpected(), {
            description: error.message,
          });
        }
      },
    },
  },
});
convexQueryClient.connect(queryClient);

const router = createRouter({
  routeTree,
  context: {
    auth: undefined!,
    convexClient: convex,
    queryClient,
  },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  defaultErrorComponent: ErrorComponent,
  defaultNotFoundComponent: NotFoundRoute,
});

export function App() {
  const locale = getLocale();
  const clerkLocalization = clerkLocalizations[locale] || clerkLocalizations.en;
  return (
    <ErrorBoundary>
      <ClerkProvider
        publishableKey={env.VITE_CLERK_PUBLISHABLE_KEY}
        localization={clerkLocalization}
      >
        <ConvexProviderWithClerk
          client={convex}
          // eslint-disable-next-line react-hooks/react-compiler
          useAuth={useAuth}
        >
          <QueryClientProvider client={queryClient}>
            <ThemeProvider
              defaultTheme="system"
              storageKey="vite-ui-theme"
            >
              <ClerkLoading>{m.auth_loading()}</ClerkLoading>
              <ClerkLoaded>
                <ErrorSuspense>
                  <RouterwithContext />
                </ErrorSuspense>
              </ClerkLoaded>
            </ThemeProvider>
          </QueryClientProvider>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </ErrorBoundary>
  );
}

function RouterwithContext() {
  const auth = useAuth();

  return (
    <RouterProvider
      router={router}
      context={{ auth, convexClient: convex, queryClient }}
    />
  );
}

// Register things for typesafety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
