import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(
  new URL("../../../apps/web/src/features/mail/gmail.ts", import.meta.url),
  "utf8"
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
function connector(respond) {
  const calls = [];
  const exports = {};
  runInNewContext(compiled, {
    exports,
    TextDecoder,
    Uint8Array,
    atob,
    Date,
    Promise,
    window: {},
    require: (name) => {
      if (name === "axios")
        return {
          default: {
            get: async (url, options) => {
              calls.push({ url, options });
              return { data: await respond(url, options) };
            },
          },
        };
      if (name === "@/env") return { env: {} };
      throw new Error(name);
    },
  });
  return { api: exports, calls };
}
const session = {
  account: "alice@gmail.com",
  token: "private-token",
  expiresAt: Date.now() + 60000,
};
const permissions = {
  account: session.account,
  connected: true,
  excluded: false,
  labelId: "INBOX",
  bodies: false,
  threadContext: false,
  attachments: false,
};
const encoded = (text) => Buffer.from(text).toString("base64url");
const message = (id, labelIds = ["INBOX"]) => ({
  id,
  threadId: "thread",
  labelIds,
  payload: {
    mimeType: "text/plain",
    headers: [{ name: "Subject", value: "Please reply" }],
    body: { data: encoded("private body") },
  },
});

test("Gmail reads are GET-only, label scoped, bounded, and never process bodies without permission", async () => {
  const c = connector((url) =>
    url.endsWith("/messages")
      ? { messages: [{ id: "one", threadId: "thread" }] }
      : message("one")
  );
  await c.api.listMessages(session, permissions, 25);
  const result = await c.api.readMessage(session, permissions, "one");
  assert.equal(result.text, "");
  assert.equal(result.attachments.length, 0);
  assert.equal(c.calls[0].options.params.labelIds, "INBOX");
  assert.equal(c.calls[0].options.params.maxResults, 25);
  assert.equal(c.calls[1].options.params.format, "metadata");
  assert.ok(!c.calls[1].options.params.fields.includes(",data"));
  assert.ok(
    c.calls.every((c) =>
      c.url.startsWith("https://gmail.googleapis.com/gmail/v1/users/me/")
    )
  );
});

test("Gmail checks account, exclusions, token expiry and selected-label membership before exposing content", async () => {
  const c = connector(() => message("one", ["OTHER"]));
  for (const source of [
    { ...permissions, excluded: true },
    { ...permissions, connected: false },
    { ...permissions, account: "bob@gmail.com" },
  ])
    await assert.rejects(c.api.listMessages(session, source));
  await assert.rejects(
    c.api.listMessages({ ...session, expiresAt: 0 }, permissions)
  );
  assert.equal(c.calls.length, 0);
  await assert.rejects(
    c.api.readMessage(session, { ...permissions, bodies: true }, "one"),
    /outside the selected Source/
  );
});

test("Gmail body, thread context and text attachment permissions remain independent", async () => {
  const c = connector((url) => {
    if (url.includes("/threads/"))
      return {
        messages: [
          { id: "one", labelIds: ["INBOX"] },
          { id: "two", labelIds: ["INBOX"] },
          { id: "excluded", labelIds: ["OTHER"] },
        ],
      };
    if (url.includes("/attachments/"))
      return { data: encoded("attachment text") };
    const value = message(url.endsWith("two") ? "two" : "one");
    value.payload.parts = [
      {
        filename: "text.txt",
        mimeType: "text/plain",
        body: { attachmentId: "att", size: 20 },
      },
      {
        filename: "private.pdf",
        mimeType: "application/pdf",
        body: { attachmentId: "pdf", size: 50 },
      },
    ];
    return value;
  });
  const result = await c.api.readMessage(
    session,
    { ...permissions, bodies: true, threadContext: true },
    "one"
  );
  assert.match(result.text, /private body/);
  assert.ok(
    !c.calls.some(
      (c) => c.url.includes("excluded") || c.url.includes("/attachments/")
    )
  );
  const attachments = await c.api.readMessage(
    session,
    { ...permissions, attachments: true },
    "one"
  );
  assert.equal(attachments.text, "");
  assert.match(attachments.attachments[0], /attachment text/);
  assert.ok(!c.calls.some((c) => c.url.endsWith("/attachments/pdf")));
});

test("Gmail failures expose a safe unavailable state without leaking tokens or Axios request data", async () => {
  const c = connector(() => {
    throw new Error("private-token in request config");
  });
  await assert.rejects(
    c.api.listMessages(session, permissions),
    (error) =>
      error.message.includes("unavailable") &&
      !error.message.includes("private-token")
  );
});

test("Revoking Source permissions aborts pending reads before attachments or thread context can be loaded", async () => {
  const controller = new AbortController();
  const c = connector(() => {
    controller.abort();
    const value = message("one");
    value.payload.parts = [
      {
        filename: "text.txt",
        mimeType: "text/plain",
        body: { attachmentId: "att", size: 20 },
      },
    ];
    return value;
  });
  await assert.rejects(
    c.api.readMessage(
      { ...session, signal: controller.signal },
      { ...permissions, attachments: true },
      "one"
    ),
    /permissions changed/
  );
  assert.equal(c.calls.length, 1);
});
