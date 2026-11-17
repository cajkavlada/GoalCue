import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

import { SignedIn, SignedOut, SignInButton, UserButton } from "@gc/auth";
import { m } from "@gc/i18n/messages";
import { Button, ModeSelector } from "@gc/ui";

import { LocaleSelector } from "@/components/locale-selector";

export const Route = createFileRoute("/{-$locale}")({
  component: RouteComponent,
});

function RouteComponent() {
  const links = [
    { to: "/{-$locale}/dashboard/day", label: m.planning_day() },
    { to: "/{-$locale}/dashboard/week", label: m.plan_week() },
    { to: "/{-$locale}/dashboard/month", label: m.plan_month() },
    { to: "/{-$locale}/dashboard/projects", label: m.projects_title() },
    { to: "/{-$locale}/settings", label: m.nav_settings() },
  ] as const;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-b px-3 py-2">
        <SignedIn>
          <nav
            aria-label={m.plan_navigation()}
            className="mr-auto flex flex-wrap items-center gap-1"
          >
            {links.map((link) => (
              <Button
                key={link.to}
                variant="ghost"
                asChild
              >
                <Link
                  to={link.to}
                  search={(prev) => prev}
                  activeProps={{
                    className: "bg-accent text-accent-foreground",
                  }}
                  activeOptions={{ exact: true, includeSearch: false }}
                >
                  {link.label}
                </Link>
              </Button>
            ))}
          </nav>
        </SignedIn>
        <LocaleSelector />
        <ModeSelector />
        <SignedIn>
          <UserButton />
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            {m.auth_signIn_button_label()}
          </SignInButton>
        </SignedOut>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
