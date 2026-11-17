import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../package.json", import.meta.url));
const ts = require("typescript");
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@gc/db")
      return next(
        new URL("../../db/src/index.ts", import.meta.url).href,
        context
      );
    if (specifier.startsWith(".") && context.parentURL) {
      const url = new URL(specifier, context.parentURL);
      for (const suffix of [".ts", "/index.ts", ".js"]) {
        if (existsSync(fileURLToPath(url) + suffix))
          return next(url.href + suffix, context);
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts"))
      return {
        format: "module",
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
          },
        }).outputText,
      };
    return next(url, context);
  },
});
const ai = await import("../convex/ai.ts");
const actions = await import("../convex/aiActions.ts");
const providers = await import("../convex/utils/aiProviders.ts");
const policy = await import("../convex/utils/aiPolicy.ts");
const { default: axios } = await import("axios");
const { getFunctionName } = await import("convex/server");

function database() {
  const rows = new Map();
  let id = 0;
  const db = {
    get: async (id) => rows.get(id) ?? null,
    insert: async (table, value) => {
      const key = `${table}-${++id}`;
      rows.set(key, { ...value, _id: key });
      return key;
    },
    replace: async (id, value) => rows.set(id, { ...value, _id: id }),
    patch: async (id, patch) => {
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) delete rows.get(id)[key];
        else rows.get(id)[key] = value;
      }
    },
    query(table) {
      const filters = [];
      const builder = {
        eq: (key, value) => {
          filters.push((row) => row[key] === value);
          return builder;
        },
        gte: (key, value) => {
          filters.push((row) => row[key] >= value);
          return builder;
        },
      };
      const matching = () =>
        [...rows.values()].filter(
          (row) =>
            row._id.startsWith(table + "-") && filters.every((fn) => fn(row))
        );
      const query = {
        withIndex: (_name, callback) => {
          callback(builder);
          return query;
        },
        order: () => query,
        collect: async () => matching(),
        unique: async () => {
          assert.ok(matching().length <= 1);
          return matching()[0] ?? null;
        },
        take: async (count) => matching().slice(0, count),
      };
      return query;
    },
  };
  const context = (user = "alice") => {
    const ctx = {
      db,
      auth: { getUserIdentity: async () => (user ? { subject: user } : null) },
    };
    ctx.runQuery = ctx.runMutation = async (ref, args) =>
      ai[getFunctionName(ref).split(":")[1]]._handler(ctx, args);
    return ctx;
  };
  return { db, rows, context };
}

function reviews() {
  const review = {
    inputRate: 2,
    outputRate: 10,
    checkedAt: Date.now() - 1000,
    expiresAt: Date.now() + 86400000,
    retention: "Standard provider retention applies; optional storage disabled",
    accountSettingsChecked: true,
  };
  return Object.fromEntries(
    Object.entries(policy.supportedModels).flatMap(([provider, models]) =>
      models.map((model) => [`${provider}/${model}`, review])
    )
  );
}

async function configure(ctx, extra = {}) {
  return ai.configure._handler(ctx, {
    userId: "alice",
    provider: "openai",
    funding: "personal",
    encryptedKey: providers.encryptKey("private-key", "alice", "openai"),
    chatModel: "gpt-6.1-sol",
    backgroundModel: "gpt-6-luna",
    monthlyLimit: 10000000,
    warningThreshold: 0.8,
    version: "v1",
    revision:
      policy.reviewedModel("openai", "gpt-6.1-sol").revision +
      policy.reviewedModel("openai", "gpt-6-luna").revision,
    ...extra,
  });
}
const reserve = (ctx, requestId, role = "chat", extra = {}) =>
  ai.reserve._handler(ctx, {
    userId: "alice",
    role,
    requestId,
    version: "v1",
    ...extra,
  });

test.beforeEach((t) => {
  t.mock.method(Date, "now", () => Date.UTC(2026, 10, 17));
  process.env.AI_MODEL_REVIEWS = JSON.stringify(reviews());
  process.env.AI_KEY_ENCRYPTION_SECRET = Buffer.alloc(32, 9).toString("base64");
  process.env.AI_OWNER_SUBJECT = "owner";
  process.env.AI_OWNER_FUNDED_SUBJECTS = "";
});

test("keys are encrypted with identity/provider binding and never returned in reports", async () => {
  const { context, rows } = database();
  const ctx = context();
  await configure(ctx);
  const connection = [...rows.values()][0];
  assert.ok(!connection.encryptedKey.includes("private-key"));
  assert.equal(
    providers.decryptKey(connection.encryptedKey, "alice", "openai"),
    "private-key"
  );
  assert.throws(() =>
    providers.decryptKey(connection.encryptedKey, "bob", "openai")
  );
  assert.throws(() =>
    providers.decryptKey(connection.encryptedKey, "alice", "gemini")
  );
  const status = await ai.status._handler(ctx, {});
  assert.equal(status.key, "••••••••");
  assert.ok(!JSON.stringify(status).includes(connection.encryptedKey));
  assert.equal((await ai.status._handler(context("bob"), {})).enabled, false);
  await assert.rejects(
    ai.status._handler(context(null), {}),
    /Not authenticated/
  );
  await ai.disable._handler(ctx, { removeKey: true });
  assert.equal(connection.encryptedKey, undefined);
  assert.equal(connection.enabled, false);
});

test("activation requires current reviews, consent, an account model check, and explicit grants", async (t) => {
  const { context } = database();
  const ctx = context();
  let checks = 0;
  t.mock.method(axios, "get", async (url) => {
    checks++;
    return { data: { id: url.split("/").at(-1) } };
  });
  const args = {
    provider: "openai",
    funding: "personal",
    key: "secret",
    chatModel: "gpt-6.1-sol",
    backgroundModel: "gpt-6-luna",
    retentionAccepted: true,
    accountSettingsChecked: true,
  };
  await assert.rejects(
    actions.activate._handler(ctx, { ...args, retentionAccepted: false })
  );
  await assert.rejects(
    actions.activate._handler(ctx, { ...args, chatModel: "arbitrary-model" })
  );
  await assert.rejects(
    actions.activate._handler(ctx, { ...args, funding: "owner" }),
    /not been granted/
  );
  assert.equal(checks, 0);
  await actions.activate._handler(ctx, args);
  assert.equal(checks, 2);
  process.env.AI_MODEL_REVIEWS = "{}";
  await assert.rejects(
    actions.generate._handler(ctx, {
      role: "chat",
      requestId: "expired",
      prompt: "Plan today",
    }),
    /review required/
  );
});

test("reservations prevent overcommit, isolate roles, and reconcile once", async () => {
  const { context } = database();
  const ctx = context();
  await configure(ctx, { monthlyLimit: 299999 });
  const first = await reserve(ctx, "first");
  await assert.rejects(reserve(ctx, "concurrent"), /concurrency/);
  const background = await reserve(ctx, "background", "background");
  await ai.settle._handler(ctx, {
    runId: background,
    outcome: "complete",
    inputTokens: 1000,
    outputTokens: 100,
  });
  await ai.settle._handler(ctx, {
    runId: background,
    outcome: "complete",
    inputTokens: 1000,
    outputTokens: 100,
  });
  await ai.settle._handler(ctx, { runId: first, outcome: "unknown" });
  let report = await ai.status._handler(ctx, {});
  assert.equal(report.reserved, 72000);
  assert.equal(report.spent, 3000);
  assert.equal(
    report.roles.find((row) => row.role === "background").spent,
    3000
  );
  await assert.rejects(
    reserve(ctx, "background-again", "background"),
    /Background AI allowance exhausted/
  );
  await assert.rejects(reserve(ctx, "first"), /already attempted/);
  await ai.settle._handler(ctx, {
    runId: first,
    outcome: "complete",
    inputTokens: 2000,
    outputTokens: 200,
  });
  report = await ai.status._handler(ctx, {});
  assert.equal(report.reserved, 0);
  assert.equal(report.spent, 9000);
});

test("owner grants, invitee pool and global ceiling protect the owner reserve", async (t) => {
  const { context, db } = database();
  const ctx = context();
  process.env.AI_OWNER_FUNDED_SUBJECTS = "alice,bob";
  await configure(ctx, { funding: "owner", encryptedKey: undefined });
  await db.insert("aiUsage", {
    scope: "invitee-pool",
    month: "2026-11",
    role: "chat",
    spent: 9950000,
    reserved: 0,
  });
  await assert.rejects(reserve(ctx, "pool-full"), /allowance exhausted/);
  await configure(ctx, {
    userId: "owner",
    funding: "owner",
    encryptedKey: undefined,
  });
  await reserve(ctx, "owner-ok", "chat", { userId: "owner" });
  await db.insert("aiUsage", {
    scope: "owner-global",
    month: "2026-11",
    role: "background",
    spent: 19900000,
    reserved: 0,
  });
  await assert.rejects(
    reserve(ctx, "global-full", "background", { userId: "owner" }),
    /allowance exhausted/
  );
});

test("budget warnings, rate limits and changed connections fail without provider calls", async () => {
  const { context, db } = database();
  const ctx = context();
  await configure(ctx, { monthlyLimit: 100000 });
  await db.insert("aiUsage", {
    scope: "personal:alice",
    month: "2026-11",
    role: "chat",
    spent: 80000,
    reserved: 0,
  });
  assert.equal((await ai.status._handler(ctx, {})).warning, "threshold");
  await assert.rejects(reserve(ctx, "over-budget"), /allowance exhausted/);
  await assert.rejects(
    reserve(ctx, "old-connection", "chat", { version: "old" }),
    /Activate/
  );
  for (let i = 0; i < 10; i++)
    await db.insert("aiRuns", {
      userId: "alice",
      startedAt: Date.now(),
      status: "failed",
    });
  await assert.rejects(reserve(ctx, "rate-limited"), /rate limit/);
});

test("generation binds auth, disables optional storage, meters usage and never applies planning changes", async (t) => {
  const { context, rows } = database();
  const ctx = context();
  await configure(ctx);
  let calls = 0;
  t.mock.method(axios, "post", async (url, body, options) => {
    calls++;
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(body.model, "gpt-6.1-sol");
    assert.equal(body.store, false);
    assert.equal(body.max_output_tokens, 4000);
    assert.equal(options.timeout, 60000);
    assert.equal(options.headers.Authorization, "Bearer private-key");
    assert.ok(!JSON.stringify(body).includes("private-key"));
    return {
      data: {
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "Plan suggestion" }],
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    };
  });
  const args = { role: "chat", requestId: "turn-1", prompt: "Plan today" };
  assert.equal(
    (await actions.generate._handler(ctx, args)).text,
    "Plan suggestion"
  );
  await assert.rejects(
    actions.generate._handler(ctx, args),
    /already attempted/
  );
  await assert.rejects(
    actions.generate._handler(context("bob"), { ...args, requestId: "bob" }),
    /disabled/
  );
  await assert.rejects(
    actions.generate._handler(context(null), args),
    /Not authenticated/
  );
  assert.equal(calls, 1);
  assert.equal(
    [...rows.values()].find((row) => row.requestId === "turn-1").cost,
    700
  );
  assert.ok([...rows.keys()].every((id) => /^ai/.test(id)));
});

test("provider failure holds unknown charges, never falls back or replays, and masks errors", async (t) => {
  const { context } = database();
  const ctx = context();
  await configure(ctx);
  let calls = 0;
  t.mock.method(axios, "post", async () => {
    calls++;
    throw new Error("private-key request config");
  });
  const args = { role: "chat", requestId: "timeout", prompt: "Plan today" };
  await assert.rejects(actions.generate._handler(ctx, args), (error) => {
    assert.ok(!String(error).includes("private-key"));
    assert.equal(error.data.manualPlanningAvailable, true);
    return true;
  });
  await assert.rejects(
    actions.generate._handler(ctx, args),
    /already attempted/
  );
  assert.equal(calls, 1);
  assert.equal((await ai.status._handler(ctx, {})).reserved, 72000);
});

test("Anthropic and Gemini adapters use explicit models and count billed thinking", async (t) => {
  t.mock.method(axios, "post", async (url, body, config) => {
    assert.equal(config.maxRedirects, 0);
    assert.ok(!url.includes("secret"));
    if (url.includes("anthropic")) {
      assert.equal(body.model, "claude-sonnet-5-5");
      assert.equal(body.max_tokens, 4000);
      return {
        data: {
          content: [{ type: "text", text: "Claude" }],
          usage: { input_tokens: 20, output_tokens: 10 },
        },
      };
    }
    assert.ok(url.endsWith("gemini-3.8-flash:generateContent"));
    assert.equal(config.headers["x-goog-api-key"], "secret");
    assert.equal(body.generationConfig.maxOutputTokens, 4000);
    return {
      data: {
        candidates: [{ content: { parts: [{ text: "Gemini" }] } }],
        usageMetadata: {
          promptTokenCount: 20,
          candidatesTokenCount: 10,
          thoughtsTokenCount: 5,
        },
      },
    };
  });
  assert.equal(
    (
      await providers.callProvider(
        "anthropic",
        "claude-sonnet-5-5",
        "secret",
        "Hi"
      )
    ).outputTokens,
    10
  );
  assert.equal(
    (await providers.callProvider("gemini", "gemini-3.8-flash", "secret", "Hi"))
      .outputTokens,
    15
  );
  assert.throws(
    () => providers.validatePrompt("x".repeat(16000)),
    /token bound/
  );
});

test("known credential rejection releases funds while missing usage remains reserved", async (t) => {
  const { context } = database();
  const ctx = context();
  await configure(ctx);
  t.mock.method(axios, "post", async () => {
    throw {
      isAxiosError: true,
      response: { status: 401 },
      config: { key: "private-key" },
    };
  });
  await assert.rejects(
    actions.generate._handler(ctx, {
      role: "chat",
      requestId: "invalid-key",
      prompt: "Hi",
    }),
    /AI request failed/
  );
  assert.equal((await ai.status._handler(ctx, {})).reserved, 0);
  t.mock.method(axios, "post", async () => ({ data: { output: [] } }));
  await assert.rejects(
    actions.generate._handler(ctx, {
      role: "chat",
      requestId: "missing-usage",
      prompt: "Hi",
    }),
    /usage is unavailable/
  );
  assert.equal((await ai.status._handler(ctx, {})).reserved, 72000);
});

test("global operational caps apply across personal keys and resets never replay old requests", async (t) => {
  const { context, db } = database();
  const ctx = context();
  await configure(ctx);
  for (let i = 0; i < 10; i++)
    await db.insert("aiRuns", {
      userId: "other-" + i,
      startedAt: Date.now(),
      status: "active",
      role: "chat",
    });
  await assert.rejects(reserve(ctx, "global-concurrency"), /concurrency/);
  for (let i = 0; i < 50; i++)
    await db.insert("aiRuns", {
      userId: "other-" + i,
      startedAt: Date.now(),
      status: "complete",
      role: "chat",
    });
  await assert.rejects(reserve(ctx, "global-rate"), /rate limit/);
  t.mock.method(Date, "now", () => Date.UTC(2026, 10, 17, 0, 2));
  const runId = await reserve(ctx, "last-month");
  await ai.settle._handler(ctx, { runId, outcome: "unknown" });
  t.mock.method(Date, "now", () => Date.UTC(2026, 11, 1));
  process.env.AI_MODEL_REVIEWS = JSON.stringify(reviews());
  await configure(ctx);
  assert.equal((await ai.status._handler(ctx, {})).reserved, 0);
  await assert.rejects(reserve(ctx, "last-month"), /already attempted/);
  await ai.settle._handler(ctx, {
    runId,
    outcome: "complete",
    inputTokens: 10,
    outputTokens: 10,
  });
  assert.equal((await ai.status._handler(ctx, {})).spent, 0);
});

test("changing funding or removing the key rejects stale reservations", async () => {
  const { context } = database();
  const ctx = context();
  await configure(ctx);
  await configure(ctx, { version: "v2" });
  await assert.rejects(reserve(ctx, "stale-funding"), /Activate/);
  await ai.disable._handler(ctx, { removeKey: true });
  await assert.rejects(
    reserve(ctx, "removed-key", "chat", { version: "v2" }),
    /Activate/
  );
});
