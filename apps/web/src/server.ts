import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";

import { createClerkHandler } from "@gc/auth";

import { createRouter } from "./router";

export default createClerkHandler(
  createStartHandler({
    createRouter,
  })
)(defaultStreamHandler);
