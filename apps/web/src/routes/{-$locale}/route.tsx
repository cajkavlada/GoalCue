import { createFileRoute, Outlet } from "@tanstack/react-router";

import { locales, setLocale } from "@/paraglide/runtime.js";

export const Route = createFileRoute("/{-$locale}")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <div>
        {locales.map((locale) => (
          <button
            onClick={() => setLocale(locale)}
            key={locale}
            className={`m-2 rounded-sm bg-gray-600 px-2 py-1 font-extrabold uppercase text-white dark:bg-gray-700`}
          >
            {locale}
          </button>
        ))}
      </div>
      <Outlet />
    </>
  );
}
