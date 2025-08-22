import { createFileRoute, Outlet } from "@tanstack/react-router";

import { SignedIn, SignedOut, SignInButton, UserButton } from "@gc/auth";
import { m } from "@gc/i18n/messages";
import { locales, setLocale } from "@gc/i18n/runtime";
import { ModeToggle } from "@gc/ui";

export const Route = createFileRoute("/{-$locale}")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <div className="flex justify-end gap-2 pr-4 pt-2">
        {locales.map((locale) => (
          <button
            onClick={() => setLocale(locale)}
            key={locale}
            className={`rounded-sm bg-gray-600 px-2 py-1 font-extrabold uppercase text-white dark:bg-gray-700`}
          >
            {locale}
          </button>
        ))}
        <div>
          <ModeToggle />
        </div>
        <SignedIn>
          <UserButton />
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            {m.auth_signIn_button_label()}
          </SignInButton>
        </SignedOut>
      </div>
      <Outlet />
    </>
  );
}
