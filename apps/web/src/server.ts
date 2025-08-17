export const config = {
  runtime: "nodejs",
} as const;

import "urlpattern-polyfill";

import {
  createStartHandler,
  defaultStreamHandler,
  getWebRequest,
} from "@tanstack/react-start/server";

import { createClerkHandler } from "@gc/auth";

import {
  overwriteGetLocale,
  overwriteGetUrlOrigin,
} from "./paraglide/runtime.js";
import { paraglideMiddleware } from "./paraglide/server.js";
import { createRouter } from "./router";

export default createClerkHandler(createStartHandler({ createRouter }))(
  (event) =>
    paraglideMiddleware(getWebRequest(), ({ locale, request }) => {
      overwriteGetLocale(() => locale);
      overwriteGetUrlOrigin(() => new URL(request.url).origin);
      return defaultStreamHandler(event);
    })
);
