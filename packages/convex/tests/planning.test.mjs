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
const planning = await import("../convex/planning.ts");
const {
  availabilityOn,
  dayBounds,
  eventsCompatible,
  localDateTime,
  placementConflicts,
  validatePlanning,
  zonedInstant,
} = await import("../../validators/src/planning.ts");
const { planSessions } = await import("../../validators/src/auto-planning.ts");

test.beforeEach((t) => {
  t.mock.method(Date, "now", () => 100);
});

function database() {
  const rows = new Map();
  const reads = { collected: 0, pages: [] };
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
      const matchingRows = () =>
        [...rows.values()].filter(
          (row) =>
            row._id.startsWith(table + "-") && conditions.every((fn) => fn(row))
        );
      const builder = {
        eq(key, value) {
          conditions.push((row) => row[key] === value);
          return builder;
        },
        search(key, value) {
          conditions.push((row) =>
            row[key].toLowerCase().includes(value.toLowerCase())
          );
          return builder;
        },
      };
      const query = {
        withIndex(_name, callback) {
          callback(builder);
          return query;
        },
        withSearchIndex(_name, callback) {
          callback(builder);
          return query;
        },
        order() {
          return query;
        },
        collect: async () => {
          reads.collected++;
          return matchingRows();
        },
        paginate: async (options) => {
          reads.pages.push(options);
          const matches = matchingRows();
          const offset = Number(options.cursor ?? 0);
          const page = matches.slice(offset, offset + options.numItems);
          return {
            page,
            continueCursor: String(offset + page.length),
            isDone: offset + page.length >= matches.length,
          };
        },
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
  return { db, context, rows, reads };
}

test("Day-panel Task search returns bounded pages, excludes inactive and other users' Tasks, and omits large details", async () => {
  const { db, context, reads } = database();
  const expected = [];
  for (let index = 0; index < 85; index++) {
    expected.push(
      await db.insert("tasks", {
        userId: "alice",
        title: `Read book ${index}`,
        description: "Long private Task description",
        effortMinutes: 45,
        priority: "normal",
      })
    );
  }
  await db.insert("tasks", {
    userId: "bob",
    title: "Read someone else's book",
  });
  await db.insert("tasks", {
    userId: "alice",
    title: "Read archived book",
    archivedAt: 1,
  });
  await db.insert("tasks", {
    userId: "alice",
    title: "Read completed book",
    completedAt: 1,
  });
  const otherId = await db.insert("tasks", {
    userId: "alice",
    title: "Write a letter",
  });
  const ids = [];
  let cursor = null;
  let result;
  do {
    result = await tasks.listForDayPanel._handler(context("alice"), {
      search: "  READ  ",
      paginationOpts: { cursor, numItems: 30 },
    });
    assert.ok(result.page.length <= 30);
    assert.ok(
      result.page.every(
        (task) => task.description === undefined && task.userId === undefined
      )
    );
    ids.push(...result.page.map((task) => task._id));
    cursor = result.continueCursor;
  } while (!result.isDone);
  assert.deepEqual(ids, expected);
  assert.equal(new Set(ids).size, 85);
  assert.equal(reads.collected, 0);
  const capped = await tasks.listForDayPanel._handler(context("alice"), {
    search: "",
    paginationOpts: { cursor: null, numItems: 10000 },
  });
  assert.equal(capped.page.length, 50);
  const blank = await tasks.listForDayPanel._handler(context("alice"), {
    search: "   ",
    paginationOpts: { cursor: null, numItems: 30 },
  });
  assert.deepEqual(
    blank.page.map((task) => task._id),
    expected.slice(0, 30)
  );
  const changedSearch = await tasks.listForDayPanel._handler(context("alice"), {
    search: "Write",
    paginationOpts: { cursor: null, numItems: 30 },
  });
  assert.deepEqual(
    changedSearch.page.map((task) => task._id),
    [otherId]
  );
  const missing = await tasks.listForDayPanel._handler(context("alice"), {
    search: "missing",
    paginationOpts: { cursor: null, numItems: 30 },
  });
  assert.equal(missing.isDone, true);
  assert.deepEqual(missing.page, []);
  const bob = await tasks.listForDayPanel._handler(context("bob"), {
    search: "",
    paginationOpts: { cursor: null, numItems: 30 },
  });
  assert.equal(bob.page.length, 1);
  assert.equal(reads.collected, 0);
  await assert.rejects(
    tasks.listForDayPanel._handler(context(null), {
      search: "Read",
      paginationOpts: { cursor: null, numItems: 30 },
    })
  );
});

test("Calendar Sessions retain Task identity and completion state independently of Task search pages", async () => {
  const { db, context } = database();
  const taskId = await db.insert("tasks", { userId: "alice", title: "Read" });
  const sessionId = await saveSession._handler(context("alice"), {
    taskId,
    startAt: 1000,
    endAt: 61000,
  });
  const panel = await tasks.listForDayPanel._handler(context("alice"), {
    search: "Write",
    paginationOpts: { cursor: null, numItems: 30 },
  });
  assert.deepEqual(panel.page, []);
  const [session] = await listSessions._handler(context("alice"), {});
  assert.equal(session.taskTitle, "Read");
  assert.equal(session.taskCompletedAt, undefined);
  await saveSession._handler(context("alice"), {
    taskId,
    sessionId,
    startAt: 61000,
    endAt: 121000,
  });
  await db.patch(taskId, { completedAt: 1234 });
  const [completed] = await listSessions._handler(context("alice"), {});
  assert.equal(completed.taskCompletedAt, 1234);
});

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

const settings = {
  timezone: "Europe/Prague",
  weekly: [{ weekday: 1, start: 540, end: 1020 }],
  overrides: [],
  protectedWeekly: [{ weekday: 1, start: 720, end: 780 }],
  protectedDates: [],
};
const at = (local) => zonedInstant(local, settings.timezone);

test("Full days are available without weekly setup, including weekends and DST days", () => {
  const rules = { ...settings, weekly: [], protectedWeekly: [] };
  for (const date of [
    "2026-11-16",
    "2026-11-15",
    "2026-12-25",
    "2026-03-29",
    "2026-10-25",
  ])
    assert.deepEqual(availabilityOn(date, rules).available, [
      dayBounds(date, rules.timezone),
    ]);
  const placement = {
    startAt: at("2026-11-15T03:00"),
    endAt: at("2026-11-15T04:00"),
  };
  assert.deepEqual(placementConflicts(placement, rules, []), []);
});

test("Weekly limits are optional; date overrides and Protected periods remain independent", () => {
  const rules = { ...settings, restrictAvailability: false };
  assert.deepEqual(availabilityOn("2026-11-16", rules).available, [
    dayBounds("2026-11-16", rules.timezone),
  ]);
  const protectedPlacement = {
    startAt: at("2026-11-16T12:00"),
    endAt: at("2026-11-16T12:30"),
  };
  assert.deepEqual(placementConflicts(protectedPlacement, rules, []), [
    "Protected period",
  ]);
  const closed = {
    ...rules,
    overrides: [{ date: "2026-11-16", mode: "close", windows: [] }],
  };
  assert.deepEqual(availabilityOn("2026-11-16", closed).available, []);
  assert.equal(availabilityOn("2026-11-16", closed).protected.length, 1);
  const limited = { ...rules, restrictAvailability: true };
  assert.deepEqual(availabilityOn("2026-11-15", limited).available, []);
  const early = {
    startAt: at("2026-11-16T08:00"),
    endAt: at("2026-11-16T08:30"),
  };
  assert.deepEqual(placementConflicts(early, limited, []), [
    "Outside Availability",
  ]);
  assert.deepEqual(placementConflicts(early, rules, []), []);
});

test("Saving Protected periods alone keeps full-day planning and persists optional weekly limits", async () => {
  const { db, context } = database();
  const alice = context("alice");
  const rules = { ...settings, weekly: [], restrictAvailability: false };
  await planning.saveSettings._handler(alice, rules);
  const reloaded = await planning.getSettings._handler(context("alice"), {});
  assert.equal(reloaded.restrictAvailability, false);
  assert.deepEqual(availabilityOn("2026-11-16", reloaded).available, [
    dayBounds("2026-11-16", rules.timezone),
  ]);
  const taskId = await db.insert("tasks", { userId: "alice", title: "Read" });
  await saveSession._handler(alice, {
    taskId,
    startAt: at("2026-11-16T06:00"),
    endAt: at("2026-11-16T06:30"),
    automatic: true,
  });
  await assert.rejects(
    saveSession._handler(alice, {
      taskId,
      startAt: at("2026-11-16T12:00"),
      endAt: at("2026-11-16T12:30"),
      automatic: true,
      allowConflict: true,
    }),
    /Protected period/
  );
  await planning.saveSettings._handler(alice, {
    ...settings,
    restrictAvailability: true,
  });
  await assert.rejects(
    saveSession._handler(alice, {
      taskId,
      startAt: at("2026-11-16T06:00"),
      endAt: at("2026-11-16T06:30"),
      automatic: true,
    }),
    /Outside Availability/
  );
});

test("Overnight Protected periods continue into the next date and follow DST", () => {
  const rules = {
    ...settings,
    weekly: [],
    protectedWeekly: [{ weekday: 6, start: 1320, end: 420 }],
  };
  validatePlanning(rules);
  for (const [saturday, sunday, nightHours] of [
    ["2026-03-28", "2026-03-29", 8],
    ["2026-10-24", "2026-10-25", 10],
  ]) {
    const [evening] = availabilityOn(saturday, rules).protected;
    const [morning] = availabilityOn(sunday, rules).protected;
    assert.equal(
      localDateTime(evening.startAt, rules.timezone),
      `${saturday}T22:00`
    );
    assert.equal(
      localDateTime(morning.endAt, rules.timezone),
      `${sunday}T07:00`
    );
    assert.equal(
      (evening.endAt - evening.startAt + morning.endAt - morning.startAt) /
        3600000,
      nightHours
    );
    assert.deepEqual(
      placementConflicts(
        { startAt: morning.endAt - 60000, endAt: morning.endAt },
        rules,
        []
      ),
      ["Protected period"]
    );
    assert.deepEqual(
      placementConflicts(
        { startAt: morning.endAt, endAt: morning.endAt + 60000 },
        rules,
        []
      ),
      []
    );
  }
  const dated = {
    ...rules,
    protectedWeekly: [],
    protectedDates: [{ date: "2026-11-15", start: 1320, end: 420 }],
  };
  validatePlanning(dated);
  assert.equal(
    availabilityOn("2026-11-16", dated).protected[0].endAt,
    at("2026-11-16T07:00")
  );
  assert.deepEqual(availabilityOn("2026-11-17", dated).protected, []);
});

test("Availability overrides apply in order, preserve weekly rules, and never remove Protected periods", () => {
  const date = "2026-11-16";
  const rules = {
    ...settings,
    overrides: [
      { date, mode: "add", windows: [{ start: 1020, end: 1080 }] },
      { date, mode: "remove", windows: [{ start: 600, end: 660 }] },
    ],
  };
  const times = (input) =>
    availabilityOn(date, input).available.map((w) => [
      localDateTime(w.startAt, input.timezone).slice(11),
      localDateTime(w.endAt, input.timezone).slice(11),
    ]);
  assert.deepEqual(times(rules), [
    ["09:00", "10:00"],
    ["11:00", "18:00"],
  ]);
  rules.overrides.push({
    date,
    mode: "replace",
    windows: [{ start: 480, end: 600 }],
  });
  assert.deepEqual(times(rules), [["08:00", "10:00"]]);
  rules.overrides.push({ date, mode: "close", windows: [] });
  assert.deepEqual(times(rules), []);
  assert.equal(availabilityOn(date, rules).protected.length, 1);
  assert.deepEqual(times(settings), [["09:00", "17:00"]]);
  assert.throws(() => validatePlanning({ ...settings, timezone: "invalid" }));
  assert.throws(() =>
    validatePlanning({
      ...settings,
      weekly: [{ weekday: 7, start: 540, end: 1020 }],
    })
  );
  assert.throws(() =>
    validatePlanning({
      ...settings,
      protectedDates: [{ date: "2026-02-30", start: 5, end: 8 }],
    })
  );
  assert.throws(() =>
    validatePlanning({
      ...settings,
      weekly: [{ weekday: 1, start: 600, end: 540 }],
    })
  );
});

test("Local weekly Availability and fixed Events remain correct through both DST transitions", () => {
  for (const [timezone, spring, fall] of [
    ["Europe/Prague", "2026-03-29", "2026-10-25"],
    ["America/New_York", "2026-03-08", "2026-11-01"],
  ]) {
    const rules = {
      ...settings,
      timezone,
      weekly: [{ weekday: 0, start: 540, end: 1020 }],
    };
    for (const [date, hours] of [
      [spring, 23],
      [fall, 25],
    ]) {
      const bounds = dayBounds(date, timezone);
      assert.equal((bounds.endAt - bounds.startAt) / 3600000, hours);
      const [window] = availabilityOn(date, rules).available;
      assert.equal(localDateTime(window.startAt, timezone), `${date}T09:00`);
      assert.equal(localDateTime(window.endAt, timezone), `${date}T17:00`);
      assert.equal(window.endAt - window.startAt, 8 * 3600000);
    }
    assert.throws(
      () => zonedInstant(`${spring}T02:30`, timezone),
      /does not exist/
    );
    const repeated = timezone === "Europe/Prague" ? "02:30" : "01:30";
    const first = zonedInstant(`${fall}T${repeated}`, timezone, "earlier");
    const second = zonedInstant(`${fall}T${repeated}`, timezone, "later");
    assert.equal(second - first, 3600000);
    assert.equal(
      localDateTime(first, timezone),
      localDateTime(second, timezone)
    );
  }
  const overnight = {
    startAt: at("2026-11-15T23:00"),
    endAt: at("2026-11-16T13:00"),
  };
  assert.ok(
    placementConflicts(overnight, settings, []).includes("Protected period")
  );
});

test("Availability inside a repeated hour includes both occurrences without allowing the intervening closed time", () => {
  const rules = {
    ...settings,
    weekly: [{ weekday: 0, start: 130, end: 140 }],
    protectedWeekly: [],
  };
  const fall = availabilityOn("2026-10-25", rules).available;
  assert.equal(fall.length, 2);
  for (const window of fall) {
    assert.equal(window.endAt - window.startAt, 10 * 60000);
    assert.equal(
      localDateTime(window.startAt, rules.timezone),
      "2026-10-25T02:10"
    );
  }
  const outside = {
    startAt: zonedInstant("2026-10-25T02:30", rules.timezone),
    endAt: zonedInstant("2026-10-25T02:40", rules.timezone),
  };
  assert.ok(
    placementConflicts(outside, rules, []).includes("Outside Availability")
  );
  const springRules = {
    ...rules,
    weekly: [{ weekday: 0, start: 150, end: 195 }],
  };
  const [spring] = availabilityOn("2026-03-29", springRules).available;
  assert.equal(
    localDateTime(spring.startAt, rules.timezone),
    "2026-03-29T03:00"
  );
  assert.equal(localDateTime(spring.endAt, rules.timezone), "2026-03-29T03:15");
  const crossing = availabilityOn("2026-10-25", {
    ...rules,
    weekly: [{ weekday: 0, start: 60, end: 240 }],
  }).available;
  assert.equal(crossing.length, 1);
  assert.equal(crossing[0].endAt - crossing[0].startAt, 4 * 3600000);
});

test("Availability and Events persist per user; Event edits retain identity and deletes cannot be revived", async () => {
  const { context, db } = database();
  const alice = context("alice");
  const settingsId = await planning.saveSettings._handler(alice, settings);
  await planning.saveSettings._handler(alice, {
    ...settings,
    overrides: [{ date: "2026-11-16", mode: "close", windows: [] }],
  });
  const reloaded = await planning.getSettings._handler(context("alice"), {});
  assert.equal(reloaded._id, settingsId);
  assert.equal(reloaded.overrides[0].mode, "close");
  assert.equal(await planning.getSettings._handler(context("bob"), {}), null);
  const event = {
    title: "Meeting",
    startAt: at("2026-11-16T10:00"),
    endAt: at("2026-11-16T11:00"),
    timezone: settings.timezone,
    attention: "focused",
  };
  const eventId = await planning.saveEvent._handler(alice, event);
  await planning.saveEvent._handler(alice, {
    ...event,
    eventId,
    attention: "background",
  });
  assert.equal((await db.get(eventId)).attention, "background");
  assert.equal(
    (await planning.listEvents._handler(context("alice"), {})).length,
    1
  );
  assert.deepEqual(await planning.listEvents._handler(context("bob"), {}), []);
  await assert.rejects(
    planning.saveEvent._handler(context("bob"), { ...event, eventId })
  );
  await assert.rejects(
    planning.deleteEvent._handler(context("bob"), { eventId })
  );
  await assert.rejects(
    planning.saveEvent._handler(alice, { ...event, endAt: event.startAt })
  );
  await assert.rejects(
    planning.saveEvent._handler(alice, { ...event, timezone: "invalid" })
  );
  await assert.rejects(planning.saveSettings._handler(context(null), settings));
  await assert.rejects(planning.saveEvent._handler(context(null), event));
  await planning.deleteEvent._handler(alice, { eventId });
  assert.deepEqual(
    await planning.listEvents._handler(context("alice"), {}),
    []
  );
  await assert.rejects(
    planning.saveEvent._handler(alice, { ...event, eventId })
  );
});

test("Background Events allow other Tasks and Background Events; focused Events conflict", () => {
  const interval = {
    startAt: at("2026-11-16T10:00"),
    endAt: at("2026-11-16T11:00"),
  };
  const background = { ...interval, title: "Listen", attention: "background" };
  const other = { ...interval, title: "Music", attention: "background" };
  assert.ok(eventsCompatible(background, other));
  assert.deepEqual(
    placementConflicts(interval, settings, [background, other]),
    []
  );
  assert.deepEqual(
    placementConflicts(interval, settings, [
      { ...background, compatibleActivities: [] },
    ]),
    []
  );
  assert.ok(!eventsCompatible(background, { ...other, attention: "focused" }));
  assert.equal(
    placementConflicts(interval, settings, [
      { ...background, attention: "focused" },
    ]).length,
    1
  );
  assert.deepEqual(
    placementConflicts(
      { startAt: interval.endAt, endAt: interval.endAt + 60000 },
      settings,
      [{ ...background, attention: "focused" }]
    ),
    []
  );
});

test("Server blocks automatic Task placement in Protected periods even with an override; manual exceptions leave rules intact", async () => {
  const { db, context } = database();
  const alice = context("alice");
  await planning.saveSettings._handler(alice, settings);
  const taskId = await db.insert("tasks", { userId: "alice", title: "Read" });
  const protectedPlacement = {
    taskId,
    startAt: at("2026-11-16T12:00"),
    endAt: at("2026-11-16T12:30"),
  };
  await assert.rejects(
    saveSession._handler(alice, {
      ...protectedPlacement,
      automatic: true,
      allowConflict: true,
    }),
    /Protected period/
  );
  await assert.rejects(
    saveSession._handler(alice, protectedPlacement),
    /Protected period/
  );
  const sessionId = await saveSession._handler(alice, {
    ...protectedPlacement,
    allowConflict: true,
  });
  assert.equal((await db.get(sessionId)).startAt, protectedPlacement.startAt);
  assert.deepEqual(
    (await planning.getSettings._handler(alice, {})).protectedWeekly,
    settings.protectedWeekly
  );
  const freePlacement = {
    taskId,
    startAt: at("2026-11-16T10:00"),
    endAt: at("2026-11-16T10:30"),
    automatic: true,
  };
  await saveSession._handler(alice, freePlacement);
  const eventId = await planning.saveEvent._handler(alice, {
    startAt: freePlacement.startAt,
    endAt: freePlacement.endAt,
    title: "Meeting",
    timezone: settings.timezone,
    attention: "focused",
  });
  await assert.rejects(
    saveSession._handler(alice, freePlacement),
    /Event: Meeting/
  );
  await planning.saveEvent._handler(alice, {
    eventId,
    title: "Meeting",
    startAt: freePlacement.startAt,
    endAt: freePlacement.endAt,
    timezone: settings.timezone,
    attention: "background",
  });
  await saveSession._handler(alice, freePlacement);
  await assert.rejects(
    saveSession._handler(alice, {
      taskId,
      startAt: at("2026-11-16T08:00"),
      endAt: at("2026-11-16T08:30"),
      automatic: true,
    }),
    /Outside Availability/
  );
});

const autoDate = "2030-01-07";
const autoAt = (time) => at(`${autoDate}T${time}`);
const autoSettings = {
  ...settings,
  restrictAvailability: true,
  weekly: [{ weekday: 1, start: 540, end: 720 }],
  protectedWeekly: [],
};
const plan = (tasks, sessions = [], extra = {}) =>
  planSessions({
    date: autoDate,
    settings: autoSettings,
    events: [],
    tasks,
    sessions,
    now: autoAt("08:00"),
    ...extra,
  });
const task = (id, effortMinutes = 60, extra = {}) => ({
  _id: id,
  title: id,
  effortMinutes,
  ...extra,
});
const session = (id, taskId, from, to, extra = {}) => ({
  _id: id,
  taskId,
  startAt: autoAt(from),
  endAt: autoAt(to),
  manualOverride: false,
  ...extra,
});

test("Automatic planning splits effort around Events and Protected periods within Session limits", () => {
  const result = plan(
    [task("read", 180, { minSessionMinutes: 20, maxSessionMinutes: 40 })],
    [],
    {
      settings: {
        ...autoSettings,
        protectedDates: [{ date: autoDate, start: 600, end: 620 }],
      },
      events: [
        {
          title: "Meeting",
          attention: "focused",
          startAt: autoAt("09:40"),
          endAt: autoAt("10:00"),
        },
      ],
    }
  );
  const placed = result.changes.map((c) => c.after);
  assert.equal(placed.length, 4);
  assert.equal(result.shortfalls[0].minutes, 40);
  for (const interval of placed) {
    assert.ok((interval.endAt - interval.startAt) / 60000 >= 20);
    assert.ok((interval.endAt - interval.startAt) / 60000 <= 40);
    assert.deepEqual(
      placementConflicts(
        interval,
        {
          ...autoSettings,
          protectedDates: [{ date: autoDate, start: 600, end: 620 }],
        },
        [
          {
            title: "Meeting",
            attention: "focused",
            startAt: autoAt("09:40"),
            endAt: autoAt("10:00"),
          },
        ]
      ),
      []
    );
  }
});

test("Ordinary Tasks use gaps; minor optimization and deadline extensions leave existing Sessions stable", () => {
  const existing = session("keep", "existing", "10:00", "11:00");
  const tasks = [
    task("existing", 60, { dueAt: autoAt("12:00") }),
    task("new", 60),
  ];
  const first = plan(tasks, [existing]);
  assert.ok(first.changes.every((c) => c.id !== "keep"));
  const created = first.changes.map((c) => ({
    _id: c.id,
    taskId: c.taskId,
    ...c.after,
  }));
  assert.deepEqual(
    plan(
      tasks.map((t) => ({ ...t, dueAt: undefined })),
      [existing, ...created]
    ).changes,
    []
  );
});

test("Deadline pressure displaces only flexible lower-priority work and shows the displaced shortfall", () => {
  const tasks = [
    task("low", 180, { priority: "low" }),
    task("due", 60, {
      priority: "low",
      dueAt: autoAt("10:00"),
      finishKind: "firm",
    }),
  ];
  const sessions = [
    session("first", "low", "09:00", "10:00"),
    session("stable", "low", "10:00", "11:00"),
  ];
  const result = plan(tasks, sessions);
  assert.ok(
    result.changes.some(
      (c) => c.taskId === "due" && c.after.endAt <= autoAt("10:00")
    )
  );
  assert.ok(result.changes.every((c) => c.id !== "stable"));
  assert.ok(
    result.changes.some(
      (c) => c.id === "first" && c.reason.includes("pressing")
    )
  );
  assert.equal(result.shortfalls.find((s) => s.taskId === "low").minutes, 60);
  assert.equal(tasks[0].effortMinutes, 180);
  assert.equal(tasks[1].dueAt, autoAt("10:00"));
});

test("Pins, manual overrides and active Sessions survive pressing work; changed boundaries surface pinned conflicts", () => {
  const tasks = [
    task("held", 180),
    task("critical", 60, { priority: "critical" }),
  ];
  const sessions = [
    session("pin", "held", "09:00", "10:00", { pinned: true }),
    session("manual", "held", "10:00", "11:00", { manualOverride: true }),
    session("active", "held", "11:00", "12:00"),
  ];
  const result = plan(tasks, sessions, {
    now: autoAt("11:30"),
    events: [
      {
        title: "New Event",
        attention: "focused",
        startAt: autoAt("09:00"),
        endAt: autoAt("10:00"),
      },
    ],
  });
  assert.deepEqual(result.changes, []);
  assert.equal(
    result.shortfalls.find((s) => s.taskId === "critical").minutes,
    60
  );
  const conflict = plan(tasks, sessions, {
    events: [
      {
        title: "New Event",
        attention: "focused",
        startAt: autoAt("09:00"),
        endAt: autoAt("10:00"),
      },
    ],
  });
  assert.ok(conflict.conflicts.some((c) => c.includes("pinned")));
  assert.ok(conflict.changes.every((c) => c.id !== "pin" && c.id !== "manual"));
});

test("A boundary change moves the affected Session, preserving identity and unrelated placements", () => {
  const result = plan(
    [task("affected"), task("stable")],
    [
      session("move", "affected", "09:00", "10:00", { manualOverride: true }),
      session("keep", "stable", "10:00", "11:00"),
    ],
    {
      events: [
        {
          title: "Meeting",
          attention: "focused",
          startAt: autoAt("09:00"),
          endAt: autoAt("10:00"),
        },
      ],
    }
  );
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].id, "move");
  assert.equal(result.changes[0].after.startAt, autoAt("11:00"));
});

test("Preferred dates may slip, Firm deadlines and missing estimates produce explicit shortfalls", () => {
  const result = plan([
    task("preferred", 60, { finishKind: "preferred", dueAt: autoAt("08:00") }),
    task("firm", 60, { finishKind: "firm", dueAt: autoAt("08:00") }),
    task("unknown", undefined),
  ]);
  assert.ok(result.changes.some((c) => c.taskId === "preferred"));
  assert.ok(!result.changes.some((c) => c.taskId === "firm"));
  assert.equal(result.shortfalls.find((s) => s.taskId === "firm").minutes, 60);
});

test("Automatic plans persist per user, react to Event changes, and undo preserves unrelated manual edits", async () => {
  const { db, context } = database();
  const alice = context("alice");
  await planning.saveSettings._handler(alice, autoSettings);
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Read",
    effortMinutes: 60,
    currentNumValue: 12,
  });
  await db.insert("tasks", {
    userId: "bob",
    title: "Private",
    effortMinutes: 60,
  });
  await planning.planDay._handler(alice, {
    date: autoDate,
    timezone: settings.timezone,
  });
  const first = await listSessions._handler(context("alice"), {});
  assert.equal(first.length, 1);
  assert.equal(first[0].taskId, taskId);
  assert.equal(await planning.getDayPlan._handler(context("bob"), {}), null);
  await planning.planDay._handler(alice, {
    date: autoDate,
    timezone: settings.timezone,
  });
  assert.equal((await listSessions._handler(alice, {}))[0]._id, first[0]._id);
  const eventId = await planning.saveEvent._handler(alice, {
    title: "Meeting",
    startAt: autoAt("09:00"),
    endAt: autoAt("10:00"),
    timezone: settings.timezone,
    attention: "focused",
  });
  const moved = (await listSessions._handler(alice, {}))[0];
  assert.equal(moved._id, first[0]._id);
  assert.equal(moved.startAt, autoAt("10:00"));
  await assert.rejects(
    planning.undoPlan._handler(alice, {}),
    /no longer possible/
  );
  await planning.deleteEvent._handler(alice, { eventId });
  const otherTask = await db.insert("tasks", {
    userId: "alice",
    title: "Manual",
  });
  const otherSession = await saveSession._handler(alice, {
    taskId: otherTask,
    startAt: autoAt("11:00"),
    endAt: autoAt("12:00"),
  });
  await planning.undoPlan._handler(alice, {});
  assert.equal((await db.get(moved._id)).startAt, autoAt("09:00"));
  assert.equal((await db.get(moved._id)).manualOverride, true);
  assert.equal((await db.get(otherSession)).startAt, autoAt("11:00"));
  assert.equal((await db.get(taskId)).currentNumValue, 12);
  await assert.rejects(
    planning.planDay._handler(context(null), {
      date: autoDate,
      timezone: settings.timezone,
    })
  );
});

test("Undoing new automatic Sessions pauses their Task until the user resumes planning", async () => {
  const { db, context } = database();
  const alice = context("alice");
  await planning.saveSettings._handler(alice, autoSettings);
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Read",
    effortMinutes: 60,
  });
  await planning.planDay._handler(alice, {
    date: autoDate,
    timezone: settings.timezone,
  });
  await planning.undoPlan._handler(alice, {});
  assert.equal((await db.get(taskId)).automaticSchedulingPaused, true);
  await planning.planDay._handler(alice, {
    date: autoDate,
    timezone: settings.timezone,
  });
  assert.deepEqual(await listSessions._handler(alice, {}), []);
});

test("Undo refuses to overwrite a later edit to an affected Session", async () => {
  const { db, context } = database();
  const alice = context("alice");
  await planning.saveSettings._handler(alice, autoSettings);
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Read",
    effortMinutes: 60,
  });
  await planning.planDay._handler(alice, {
    date: autoDate,
    timezone: settings.timezone,
  });
  const [s] = await listSessions._handler(alice, {});
  await saveSession._handler(alice, {
    sessionId: s._id,
    taskId,
    startAt: autoAt("10:00"),
    endAt: autoAt("11:00"),
  });
  await assert.rejects(
    planning.undoPlan._handler(alice, {}),
    /plan has changed/
  );
  assert.equal((await db.get(s._id)).startAt, autoAt("10:00"));
});

test("Task creation, bounds edits, and completion trigger automatic planning without changing progress", async () => {
  const { db, context } = database();
  const alice = context("alice");
  await planning.saveSettings._handler(alice, autoSettings);
  await planning.planDay._handler(alice, {
    date: autoDate,
    timezone: settings.timezone,
  });
  const taskTypeId = await db.insert("taskTypes", {
    userId: "alice",
    valueKind: "boolean",
  });
  const priorityClassId = await db.insert("priorityClasses", {
    userId: "alice",
  });
  const taskId = await tasks.create._handler(alice, {
    title: "Read",
    taskTypeId,
    priorityClassId,
    tags: [],
    effortMinutes: 90,
  });
  assert.equal((await listSessions._handler(alice, {})).length, 2);
  await tasks.update._handler(alice, {
    taskId,
    title: "Read",
    priorityClassId,
    tags: [],
    effortMinutes: 90,
    minSessionMinutes: 30,
    maxSessionMinutes: 30,
  });
  const resized = await listSessions._handler(alice, {});
  assert.equal(resized.length, 3);
  assert.ok(resized.every((s) => s.endAt - s.startAt === 30 * 60000));
  assert.equal((await db.get(taskId)).completedAt, undefined);
  await assert.rejects(
    tasks.update._handler(alice, {
      taskId,
      title: "Read",
      priorityClassId,
      tags: [],
      effortMinutes: 90,
      minSessionMinutes: 60,
      maxSessionMinutes: 30,
    }),
    /Minimum Session duration/
  );
  const actions = await import("../convex/taskActions.ts");
  await actions.addToCompleted._handler(alice, { taskIds: [taskId] });
  assert.deepEqual(await listSessions._handler(alice, {}), []);
  assert.equal((await db.get(taskId)).effortMinutes, 90);
});

test("Automatic Sessions respect real elapsed Availability through DST changes", () => {
  for (const date of ["2030-03-31", "2030-10-27"]) {
    const rules = {
      ...autoSettings,
      weekly: [{ weekday: 0, start: 120, end: 240 }],
    };
    const result = planSessions({
      date,
      settings: rules,
      events: [],
      tasks: [task("read", 120)],
      sessions: [],
      now: dayBounds(date, rules.timezone).startAt,
    });
    for (const change of result.changes)
      assert.deepEqual(placementConflicts(change.after, rules, []), []);
    const expected = date.includes("03-31") ? 60 : 120;
    assert.equal(
      result.changes.reduce(
        (n, c) => n + (c.after.endAt - c.after.startAt) / 60000,
        0
      ),
      expected
    );
    assert.equal(result.shortfalls[0]?.minutes ?? 0, 120 - expected);
  }
});

test("Existing manual Sessions without automation metadata retain placement and duration", () => {
  const legacy = {
    _id: "legacy",
    taskId: "manual",
    startAt: autoAt("09:00"),
    endAt: autoAt("12:00"),
  };
  const result = plan(
    [task("manual", 180), task("urgent", 60, { priority: "critical" })],
    [legacy]
  );
  assert.deepEqual(result.changes, []);
  assert.equal(
    result.shortfalls.find((s) => s.taskId === "urgent").minutes,
    60
  );
});

test("New and moved Sessions cannot start in the past, even with a conflict override", async (t) => {
  const { db, context } = database();
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Urgent",
    effortMinutes: 30,
  });
  t.mock.method(Date, "now", () => autoAt("11:00"));
  for (const automatic of [false, true])
    await assert.rejects(
      saveSession._handler(context("alice"), {
        taskId,
        startAt: autoAt("09:00"),
        endAt: autoAt("09:30"),
        automatic,
        allowConflict: true,
      }),
      /past/
    );
  const id = await saveSession._handler(context("alice"), {
    taskId,
    startAt: autoAt("12:00"),
    endAt: autoAt("12:30"),
  });
  await assert.rejects(
    saveSession._handler(context("alice"), {
      sessionId: id,
      taskId,
      startAt: autoAt("10:00"),
      endAt: autoAt("10:30"),
    }),
    /past/
  );
});

test("Tight Firm deadlines never place new Sessions before now, including when viewing an earlier Day", () => {
  const now = autoAt("10:47");
  for (const date of [autoDate, "2030-01-06"]) {
    const result = plan(
      [
        task("urgent", 60, {
          dueAt: autoAt("11:00"),
          finishKind: "firm",
          minSessionMinutes: 5,
        }),
      ],
      [],
      { now, date }
    );
    assert.ok(result.changes.every((c) => !c.after || c.after.startAt >= now));
    assert.ok(result.shortfalls.some((s) => s.taskId === "urgent"));
  }
});

test("Explicit full replanning rebuilds future manual placements while preserving Pins and active Sessions", () => {
  const tasks = [task("late", 30), task("pinned", 30), task("active", 30)];
  const sessions = [
    session("late", "late", "11:00", "11:30", { manualOverride: true }),
    session("pin", "pinned", "10:00", "10:30", { pinned: true }),
    session("active", "active", "09:00", "09:30"),
  ];
  const now = autoAt("09:10");
  assert.deepEqual(plan(tasks, sessions, { now }).changes, []);
  const result = plan(tasks, sessions, { now, replanAll: true });
  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].id, "late");
  assert.equal(result.changes[0].after.startAt, autoAt("09:30"));
});

test("Replan all resumes Tasks paused by unscheduling and persists the resumed state", async () => {
  const { db, context } = database();
  const alice = context("alice");
  await planning.saveSettings._handler(alice, autoSettings);
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Important",
    effortMinutes: 60,
    automaticSchedulingPaused: true,
  });
  await planning.planDay._handler(alice, {
    date: autoDate,
    timezone: settings.timezone,
    replanAll: true,
  });
  const planned = await listSessions._handler(alice, {});
  assert.equal(
    planned.reduce((n, s) => n + (s.endAt - s.startAt) / 60000, 0),
    60
  );
  assert.equal((await db.get(taskId)).automaticSchedulingPaused, false);
});

test("Important's 45-minute manual placement and 15-minute automatic remainder cover its 60-minute estimate", () => {
  const result = plan(
    [task("Important", 60, { dueAt: autoAt("12:00"), finishKind: "firm" })],
    [session("manual", "Important", "09:00", "09:45", { manualOverride: true })]
  );
  assert.equal(result.changes.length, 1);
  assert.equal(
    (result.changes[0].after.endAt - result.changes[0].after.startAt) / 60000,
    15
  );
  assert.deepEqual(result.shortfalls, []);
});

test("Urgent work receives its full effort before lower-priority automatic Sessions", () => {
  const result = plan(
    [
      task("Important", 60, {
        priority: "high",
        dueAt: autoAt("10:00"),
        finishKind: "firm",
      }),
      task("other", 120, { priority: "low" }),
    ],
    [
      session("other1", "other", "09:00", "10:00"),
      session("other2", "other", "10:00", "11:00"),
    ]
  );
  assert.equal(
    result.changes
      .filter((c) => c.taskId === "Important" && c.after)
      .reduce((n, c) => n + (c.after.endAt - c.after.startAt) / 60000, 0),
    60
  );
  assert.ok(
    result.changes
      .filter((c) => c.taskId === "Important" && c.after)
      .every((c) => c.after.endAt <= autoAt("10:00"))
  );
});

test("Scheduling a single Task resumes that Task without resuming other paused Tasks", async () => {
  const { db, context } = database();
  const alice = context("alice");
  await planning.saveSettings._handler(alice, autoSettings);
  const selected = await db.insert("tasks", {
    userId: "alice",
    title: "Selected",
    effortMinutes: 60,
    automaticSchedulingPaused: true,
  });
  const other = await db.insert("tasks", {
    userId: "alice",
    title: "Other",
    effortMinutes: 60,
    automaticSchedulingPaused: true,
  });
  await planning.scheduleTask._handler(alice, {
    taskId: selected,
    date: autoDate,
    timezone: settings.timezone,
  });
  assert.equal((await db.get(selected)).automaticSchedulingPaused, false);
  assert.equal((await db.get(other)).automaticSchedulingPaused, true);
  assert.ok(
    (await listSessions._handler(alice, {})).every((s) => s.taskId === selected)
  );
  await assert.rejects(
    planning.scheduleTask._handler(context("bob"), {
      taskId: selected,
      date: autoDate,
      timezone: settings.timezone,
    })
  );
});

test("Deleting a Task releases its future pinned Sessions without removing history", async () => {
  const { db, context } = database();
  const alice = context("alice");
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Delete sample",
  });
  const pinned = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: autoAt("09:00"),
    endAt: autoAt("10:00"),
    pinned: true,
  });
  const historical = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: 1,
    endAt: 99,
  });
  await tasks.archive._handler(alice, { taskIds: [taskId] });
  assert.equal((await db.get(pinned)).unscheduledAt, 100);
  assert.equal((await db.get(historical)).unscheduledAt, undefined);
});
