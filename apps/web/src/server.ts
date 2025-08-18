import {
  createStartHandler,
  defaultStreamHandler,
  getWebRequest,
} from "@tanstack/react-start/server";

import { createClerkHandler } from "@gc/auth";
import { overwriteGetLocale } from "@gc/i18n/runtime";
import { paraglideMiddleware } from "@gc/i18n/server";

import { createRouter } from "./router";

export default createClerkHandler(createStartHandler({ createRouter }))(
  (event) =>
    paraglideMiddleware(getWebRequest(), ({ locale }) => {
      overwriteGetLocale(() => locale);
      return defaultStreamHandler(event);
    })
);
