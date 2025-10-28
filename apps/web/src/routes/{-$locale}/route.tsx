import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Home, Settings } from "lucide-react";

import { SignedIn, SignedOut, SignInButton, UserButton } from "@gc/auth";
import { m } from "@gc/i18n/messages";
import { ModeSelector } from "@gc/ui";

import { LocaleSelector } from "@/components/locale-selector";

export const Route = createFileRoute("/{-$locale}")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-end gap-2 border-b px-4 py-2">
        <SignedIn>
          <div className="mr-auto flex gap-4">
            <Link to="/{-$locale}/dashboard">
              <Home />
            </Link>
            <Link to="/{-$locale}/settings">
              <Settings />
            </Link>
          </div>
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
      </div>
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
