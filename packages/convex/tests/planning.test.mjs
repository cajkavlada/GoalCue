import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

const require = createRequire(new URL("../package.json", import.meta.url));
const ts = require("typescript");
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@gc/db" || specifier === "@gc/validators") {
      return next(
        new URL(
          "../../" + specifier.slice(4) + "/src/index.ts",
          import.meta.url
        ).href,
        context
      );
    }
    if (specifier.startsWith(".") && context.parentURL) {
      const url = new URL(specifier, context.parentURL);
      for (const suffix of [".ts", "/index.ts", ".js", "/index.js"]) {
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
const { saveSession, listSessions, unscheduleSession } = await import(
  "../convex/sessions.ts"
);
const tasks = await import("../convex/tasks.ts");

function database() {
  const rows = new Map();
  let nextId = 0;
  const db = {
    get: async (id) => rows.get(id) ?? null,
    insert: async (table, value) => {
      const id = `${table}-${++nextId}`;
      rows.set(id, globalThis.structuredClone({ ...value, _id: id }));
      return id;
    },
    patch: async (id, value) => {
      const row = rows.get(id);
      for (const [key, val] of Object.entries(value)) {
        if (val === undefined) delete row[key];
        else row[key] = val;
      }
    },
    query(table) {
      const conditions = [];
      const query = {
        withIndex(_name, callback) {
          const builder = {
            eq(key, value) {
              conditions.push((row) => row[key] === value);
              return builder;
            },
          };
          callback(builder);
          return query;
        },
        order() {
          return query;
        },
        collect: async () =>
          [...rows.values()].filter(
            (row) =>
              row._id.startsWith(table + "-") &&
              conditions.every((fn) => fn(row))
          ),
        first: async () => (await query.collect())[0] ?? null,
      };
      return query;
    },
  };
  const context = (user) => ({
    db,
    auth: { getUserIdentity: async () => (user ? { subject: user } : null) },
    runMutation: async () => ({ ok: true }),
  });
  return { db, context, rows };
}

test("Sessions persist across contexts; moves and resizing preserve Task progress and identity", async () => {
  const { db, context, rows } = database();
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Read",
    currentNumValue: 12,
  });
  const sessionId = await saveSession._handler(context("alice"), {
    taskId,
    startAt: 1000,
    endAt: 61000,
  });
  await saveSession._handler(context("alice"), {
    sessionId,
    taskId,
    startAt: 86401000,
    endAt: 86521000,
  });
  await saveSession._handler(context("alice"), {
    taskId,
    startAt: 172801000,
    endAt: 172861000,
  });
  const reloaded = await listSessions._handler(context("alice"), {});
  assert.equal(reloaded.length, 2);
  assert.equal(reloaded[0]._id, sessionId);
  assert.equal(reloaded[0].endAt - reloaded[0].startAt, 120000);
  assert.equal((await db.get(taskId)).currentNumValue, 12);
  assert.equal(
    [...rows.values()].filter((r) => r._id.startsWith("tasks-")).length,
    1
  );
  assert.deepEqual(await listSessions._handler(context("bob"), {}), []);
  await assert.rejects(
    saveSession._handler(context("bob"), { taskId, startAt: 0, endAt: 1000 })
  );
  const ownTask = await db.insert("tasks", { userId: "bob" });
  await assert.rejects(
    saveSession._handler(context("bob"), {
      taskId: ownTask,
      sessionId,
      startAt: 0,
      endAt: 1000,
    })
  );
  for (const endAt of [0, -1, Infinity, NaN])
    await assert.rejects(
      saveSession._handler(context("alice"), { taskId, startAt: 0, endAt })
    );
  await assert.rejects(listSessions._handler(context(null), {}));
});

test("Task planning creates and edits one Task while legacy tracking remains available", async () => {
  const { db, context, rows } = database();
  const taskTypeId = await db.insert("taskTypes", {
    userId: "alice",
    valueKind: "boolean",
  });
  const priorityClassId = await db.insert("priorityClasses", {
    userId: "alice",
  });
  const base = { title: "Read", taskTypeId, priorityClassId, tags: [] };
  const taskId = await tasks.create._handler(context("alice"), {
    ...base,
    progressMeasure: "percentage",
    effortMinutes: 90,
    priority: "high",
    finishKind: "preferred",
    dueAt: 123456,
  });
  assert.equal((await db.get(taskId)).completedNumValue, 100);
  await db.patch(taskId, { currentNumValue: 25 });
  await tasks.update._handler(context("alice"), {
    taskId,
    title: "Read edited",
    priorityClassId,
    tags: [],
    progressMeasure: "percentage",
    effortMinutes: 120,
    priority: "critical",
    finishKind: "firm",
    dueAt: 234567,
  });
  assert.equal((await db.get(taskId)).currentNumValue, 25);
  assert.equal((await db.get(taskId)).effortMinutes, 120);
  assert.equal((await db.get(taskId)).dueAt, 234567);
  assert.equal(
    [...rows.values()].filter((r) => r._id.startsWith("tasks-")).length,
    1
  );
  for (const measure of ["time", "quantity"]) {
    const id = await tasks.create._handler(context("alice"), {
      ...base,
      progressMeasure: measure,
      completedNumValue: 60,
    });
    assert.equal((await db.get(id)).initialNumValue, 0);
    assert.equal((await db.get(id)).valueKind, "number");
  }
  const done = await tasks.create._handler(context("alice"), {
    ...base,
    progressMeasure: "done",
  });
  assert.equal((await db.get(done)).valueKind, "boolean");
  const legacy = await tasks.create._handler(context("alice"), base);
  assert.equal((await db.get(legacy)).valueKind, "boolean");
  await assert.rejects(
    tasks.create._handler(context("alice"), { ...base, effortMinutes: -1 })
  );
  await assert.rejects(
    tasks.create._handler(context("alice"), {
      ...base,
      progressMeasure: "time",
      completedNumValue: 0,
    })
  );
});

const { layoutSessions, freeDayMinutes, adjustSession, MINUTE } = await import(
  "../../../apps/web/src/features/tasks/day-calendar-layout.ts"
);

test("Calendar overlap columns group connected overlaps and reuse lanes only for nonoverlapping Sessions", () => {
  const sessions = [
    { _id: "a", startAt: 0, endAt: 90 },
    { _id: "b", startAt: 45, endAt: 90 },
    { _id: "c", startAt: 60, endAt: 120 },
    { _id: "d", startAt: 120, endAt: 180 },
    { _id: "e", startAt: 160, endAt: 200 },
  ];
  const positions = layoutSessions(sessions);
  assert.equal(positions.get("a").lanes, 3);
  assert.equal(positions.get("b").lanes, 3);
  assert.equal(positions.get("c").lanes, 3);
  assert.equal(
    new Set(["a", "b", "c"].map((id) => positions.get(id).lane)).size,
    3
  );
  assert.equal(positions.get("d").lanes, 2);
  for (const a of sessions)
    for (const b of sessions) {
      if (a._id !== b._id && a.startAt < b.endAt && b.startAt < a.endAt)
        assert.notEqual(positions.get(a._id).lane, positions.get(b._id).lane);
    }
  assert.equal(
    freeDayMinutes(
      [
        { startAt: -30 * MINUTE, endAt: 60 * MINUTE },
        { startAt: 30 * MINUTE, endAt: 90 * MINUTE },
        { startAt: 180 * MINUTE, endAt: 300 * MINUTE },
      ],
      0,
      240 * MINUTE
    ),
    90
  );
});

test("Dragging snaps to quarters, preserves duration, and keeps both resize edges within the Day", () => {
  const gesture = {
    kind: "move",
    start: 540,
    end: 590,
    pointer: 607,
    offset: 15,
    dayMinutes: 1440,
  };
  assert.deepEqual(adjustSession(gesture), { start: 585, end: 635 });
  const atEnd = adjustSession({ ...gesture, pointer: 1600 });
  assert.equal(atEnd.end - atEnd.start, 50);
  assert.equal(atEnd.start % 15, 0);
  assert.ok(atEnd.end <= 1440);
  assert.deepEqual(adjustSession({ ...gesture, kind: "start", pointer: 570 }), {
    start: 570,
    end: 590,
  });
  assert.deepEqual(adjustSession({ ...gesture, kind: "end", pointer: 632 }), {
    start: 540,
    end: 630,
  });
  assert.equal(
    adjustSession({ ...gesture, kind: "start", pointer: 900 }).end,
    590
  );
  assert.equal(
    adjustSession({ ...gesture, kind: "end", pointer: 0 }).start,
    540
  );
  for (const dayMinutes of [1380, 1500])
    assert.ok(
      adjustSession({ ...gesture, dayMinutes, pointer: 1600 }).end <= dayMinutes
    );
});

test("Unscheduling preserves the Task and progress and enforces Session ownership", async () => {
  const { db, context } = database();
  const taskId = await db.insert("tasks", {
    userId: "alice",
    currentNumValue: 12,
  });
  const sessionId = await saveSession._handler(context("alice"), {
    taskId,
    startAt: 1000,
    endAt: 61000,
  });
  await assert.rejects(
    unscheduleSession._handler(context("bob"), { sessionId })
  );
  await unscheduleSession._handler(context("alice"), { sessionId });
  assert.deepEqual(await listSessions._handler(context("alice"), {}), []);
  assert.equal((await db.get(taskId)).currentNumValue, 12);
  await assert.rejects(
    saveSession._handler(context("alice"), {
      taskId,
      sessionId,
      startAt: 1000,
      endAt: 121000,
    })
  );
});
