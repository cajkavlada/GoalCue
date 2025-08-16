import { Link } from "@tanstack/react-router";

import { Button } from "@gc/ui";

import { m } from "@/paraglide/messages";

export function NotFoundRoute() {
  return (
    <div className="space-y-2 p-2">
      <div className="text-gray-600 dark:text-gray-400">
        <p>{m.not_found_description()}</p>
      </div>
      <p className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => window.history.back()}
          className="uppercase"
        >
          {m.not_found_goBack()}
        </Button>
        <Link
          to="/{-$locale}"
          className="uppercase"
        >
          <Button>{m.not_found_startOver()}</Button>
        </Link>
      </p>
    </div>
  );
}
