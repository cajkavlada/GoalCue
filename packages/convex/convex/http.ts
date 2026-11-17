import { httpRouter } from "convex/server";

import { httpAction } from "./_generated/server";

const http = httpRouter();
http.route({
  path: "/calendar/google/callback",
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    const params = new URL(request.url).searchParams;
    try {
      const target = new URL(process.env.GOOGLE_CALENDAR_APP_URL ?? "");
      if (
        target.protocol !== "https:" &&
        !(target.protocol === "http:" && target.hostname === "localhost")
      )
        throw new Error("Invalid calendar application URL");
      target.search = "";
      target.hash = "";
      target.searchParams.set("calendarState", params.get("state") ?? "");
      if (params.get("code"))
        target.searchParams.set("calendarCode", params.get("code")!);
      return new Response(null, {
        status: 303,
        headers: {
          Location: target.href,
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      });
    } catch {
      return new Response(
        "Calendar connection failed or was declined. Close this tab and try again in GoalCue Settings. Only personal Google accounts are supported.",
        {
          status: 400,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        }
      );
    }
  }),
});
export default http;
