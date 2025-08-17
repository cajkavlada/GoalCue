import {
  createStartHandler,
  defaultStreamHandler,
  // getWebRequest,
} from "@tanstack/react-start/server";

import { createClerkHandler } from "@gc/auth";

// import { overwriteGetLocale } from "./paraglide/runtime.js";
// import { paraglideMiddleware } from "./paraglide/server.js";
import { createRouter } from "./router";

export default createClerkHandler(createStartHandler({ createRouter }))(
  defaultStreamHandler
);
//   (event) =>
//     paraglideMiddleware(getWebRequest(), ({ locale }) => {
//       overwriteGetLocale(() => locale);
//       return defaultStreamHandler(event);
//     })
// );
