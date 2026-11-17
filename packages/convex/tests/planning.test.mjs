import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";
import { runInNewContext } from "node:vm";

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
const { saveSession, listSessions, unscheduleSession, reportCheckIn } =
  await import("../convex/sessions.ts");
const tasks = await import("../convex/tasks.ts");
const mail = await import("../convex/mail.ts");
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
const { recurrenceWindows, recurrenceDate, validateRecurrence } = await import(
  "../../validators/src/recurrence.ts"
);
const { syncOccurrences } = await import("../convex/utils/recurrence.ts");

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

test("Check-ins replace additive progress and recorded time; undo preserves another Session's contribution", async () => {
  const { db, context } = database();
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Read",
    valueKind: "number",
    progressMeasure: "quantity",
    initialNumValue: 0,
    currentNumValue: 5,
    completedNumValue: 100,
  });
  const first = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: 1,
    endAt: 50,
  });
  const second = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: 51,
    endAt: 90,
  });
  const report = (input) => reportCheckIn._handler(context("alice"), input);
  await report({
    sessionId: first,
    outcome: "progress",
    value: 10,
    timeMinutes: 20,
  });
  await report({
    sessionId: second,
    outcome: "progress",
    value: 7,
    timeMinutes: 30,
  });
  await report({
    sessionId: first,
    outcome: "progress",
    value: 4,
    timeMinutes: 8,
  });
  assert.equal((await db.get(taskId)).currentNumValue, 16);
  assert.equal((await db.get(first)).checkIn.timeMinutes, 8);
  assert.equal((await db.get(second)).checkIn.timeMinutes, 30);
  await report({ sessionId: first, outcome: "undo" });
  assert.equal((await db.get(taskId)).currentNumValue, 12);
  assert.equal((await db.get(first)).checkIn, undefined);
  await report({ sessionId: first, outcome: "undo" });
  assert.equal((await db.get(taskId)).currentNumValue, 12);
});

test("Percentage reports replace values; correcting an earlier report preserves later percentage reports", async (t) => {
  const { db, context } = database();
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Write",
    valueKind: "number",
    progressMeasure: "percentage",
    currentNumValue: 0,
    initialNumValue: 0,
    completedNumValue: 100,
  });
  const first = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: 1,
    endAt: 50,
  });
  const second = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: 51,
    endAt: 90,
  });
  const report = (input) => reportCheckIn._handler(context("alice"), input);
  await report({ sessionId: first, outcome: "progress", value: 20 });
  t.mock.method(Date, "now", () => 200);
  await report({ sessionId: second, outcome: "progress", value: 50 });
  await report({ sessionId: first, outcome: "progress", value: 30 });
  assert.equal((await db.get(taskId)).currentNumValue, 50);
  await report({ sessionId: second, outcome: "undo" });
  assert.equal((await db.get(taskId)).currentNumValue, 30);
  await report({ sessionId: first, outcome: "undo" });
  assert.equal((await db.get(taskId)).currentNumValue, 0);
});

test("Only explicit completion or a measurable target completes work, and completion can be corrected", async () => {
  const { db, context } = database();
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Work",
    valueKind: "number",
    progressMeasure: "time",
    currentNumValue: 0,
    initialNumValue: 0,
    completedNumValue: 60,
    effortMinutes: 15,
  });
  const sessionId = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: 1,
    endAt: 90,
  });
  const report = (input) =>
    reportCheckIn._handler(context("alice"), { sessionId, ...input });
  await report({
    outcome: "progress",
    value: 20,
    timeMinutes: 90,
    remainingMinutes: 0,
  });
  assert.equal((await db.get(taskId)).completedAt, undefined);
  assert.equal((await db.get(taskId)).effortMinutes, 15);
  await report({ outcome: "progress", value: 60, timeMinutes: 90 });
  assert.equal((await db.get(taskId)).completedAt, 100);
  await report({ outcome: "progress", value: 10 });
  assert.equal((await db.get(taskId)).completedAt, undefined);
  assert.equal((await db.get(taskId)).currentNumValue, 10);
  await report({ outcome: "finished" });
  assert.equal((await db.get(taskId)).currentNumValue, 60);
  await report({ outcome: "undo" });
  assert.equal((await db.get(taskId)).completedAt, undefined);
  assert.equal((await db.get(taskId)).currentNumValue, 0);
});

test("Unanswered and deferred check-ins remain unknown and preserve future Sessions; a miss replans only the remainder", async (t) => {
  const now = Date.parse("2030-01-07T10:00Z");
  t.mock.method(Date, "now", () => now);
  const { db, context } = database();
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Work",
    valueKind: "boolean",
    progressMeasure: "done",
    effortMinutes: 120,
  });
  const sessionId = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: now - 3600000,
    endAt: now,
  });
  const futureId = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: now + 3600000,
    endAt: now + 7200000,
    manualOverride: false,
  });
  await planning.planDay._handler(context("alice"), {
    date: "2030-01-07",
    timezone: "UTC",
  });
  assert.equal((await listSessions._handler(context("alice"), {})).length, 2);
  await reportCheckIn._handler(context("alice"), {
    sessionId,
    outcome: "later",
  });
  assert.equal((await db.get(sessionId)).checkIn, undefined);
  assert.equal((await db.get(taskId)).completedAt, undefined);
  const future = structuredClone(await db.get(futureId));
  await reportCheckIn._handler(context("alice"), {
    sessionId,
    outcome: "missed",
  });
  assert.deepEqual(await db.get(futureId), future);
  const sessions = await listSessions._handler(context("alice"), {});
  assert.equal(sessions.length, 3);
  assert.equal((await db.get(sessionId)).unscheduledAt, undefined);
  assert.equal((await db.get(taskId)).priority, undefined);
  await reportCheckIn._handler(context("alice"), {
    sessionId,
    outcome: "undo",
  });
  assert.equal((await listSessions._handler(context("alice"), {})).length, 2);
});

test("Extensions preserve fixed Events and protected boundaries and minimally move flexible Sessions", async (t) => {
  const now = Date.parse("2030-01-07T10:00Z");
  t.mock.method(Date, "now", () => now);
  const { db, context } = database();
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Work",
    valueKind: "boolean",
    effortMinutes: 60,
  });
  const otherTaskId = await db.insert("tasks", {
    userId: "alice",
    title: "Other",
    valueKind: "boolean",
    effortMinutes: 60,
  });
  const sessionId = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: now - 3600000,
    endAt: now,
  });
  const nextId = await db.insert("sessions", {
    userId: "alice",
    taskId: otherTaskId,
    startAt: now + 60000,
    endAt: now + 3660000,
    manualOverride: false,
  });
  const eventId = await db.insert("fixedEvents", {
    userId: "alice",
    title: "Meeting",
    startAt: now + 30 * 60000,
    endAt: now + 60 * 60000,
    attention: "focused",
    timezone: "UTC",
  });
  const event = structuredClone(await db.get(eventId));
  await db.insert("dayPlans", {
    userId: "alice",
    date: "2030-01-07",
    timezone: "UTC",
    changes: [],
    shortfalls: [],
    conflicts: [],
  });
  await assert.rejects(
    reportCheckIn._handler(context("alice"), {
      sessionId,
      outcome: "working",
      extensionMinutes: 45,
    }),
    /Event: Meeting/
  );
  assert.equal((await db.get(sessionId)).endAt, now);
  await db.insert("planningSettings", {
    userId: "alice",
    timezone: "UTC",
    weekly: [],
    overrides: [],
    protectedWeekly: [],
    protectedDates: [{ date: "2030-01-07", start: 620, end: 630 }],
  });
  await assert.rejects(
    reportCheckIn._handler(context("alice"), {
      sessionId,
      outcome: "working",
      extensionMinutes: 25,
    }),
    /Protected period/
  );
  await reportCheckIn._handler(context("alice"), {
    sessionId,
    outcome: "working",
    extensionMinutes: 15,
  });
  assert.equal((await db.get(sessionId)).endAt, now + 15 * 60000);
  assert.equal((await db.get(sessionId)).checkIn, undefined);
  assert.deepEqual(await db.get(eventId), event);
  assert.ok((await db.get(nextId)).startAt >= now + 15 * 60000);
});

test("Check-ins enforce ownership, valid progress, and started Sessions", async () => {
  const { db, context } = database();
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Work",
    valueKind: "number",
    progressMeasure: "percentage",
    currentNumValue: 0,
    completedNumValue: 100,
  });
  const sessionId = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: 1,
    endAt: 90,
  });
  await assert.rejects(
    reportCheckIn._handler(context("bob"), { sessionId, outcome: "finished" }),
    /Session not found/
  );
  await assert.rejects(
    reportCheckIn._handler(context(null), { sessionId, outcome: "finished" })
  );
  for (const value of [-1, NaN, Infinity, 101])
    await assert.rejects(
      reportCheckIn._handler(context("alice"), {
        sessionId,
        outcome: "progress",
        value,
      })
    );
  await assert.rejects(
    reportCheckIn._handler(context("alice"), {
      sessionId,
      outcome: "progress",
    }),
    /Enter progress/
  );
  await db.patch(sessionId, { startAt: 200, endAt: 300 });
  await assert.rejects(
    reportCheckIn._handler(context("alice"), {
      sessionId,
      outcome: "finished",
    }),
    /not started/
  );
  assert.equal((await db.get(taskId)).currentNumValue, 0);
});

test("Undoing multiple completion reports restores the original completion state", async (t) => {
  const { db, context } = database();
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Work",
    valueKind: "boolean",
    progressMeasure: "done",
  });
  const first = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: 1,
    endAt: 50,
  });
  const second = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: 51,
    endAt: 90,
  });
  await reportCheckIn._handler(context("alice"), {
    sessionId: first,
    outcome: "finished",
  });
  t.mock.method(Date, "now", () => 200);
  await reportCheckIn._handler(context("alice"), {
    sessionId: second,
    outcome: "finished",
  });
  await reportCheckIn._handler(context("alice"), {
    sessionId: first,
    outcome: "undo",
  });
  assert.equal((await db.get(taskId)).completedAt, 100);
  await reportCheckIn._handler(context("alice"), {
    sessionId: second,
    outcome: "undo",
  });
  assert.equal((await db.get(taskId)).completedAt, undefined);
});

test("Missed Sessions without an estimate receive one replacement across repeated replans", async (t) => {
  const now = Date.parse("2030-01-07T10:00Z");
  t.mock.method(Date, "now", () => now);
  const { db, context } = database();
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Work",
    valueKind: "boolean",
  });
  const sessionId = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: now - 3600000,
    endAt: now,
  });
  await planning.planDay._handler(context("alice"), {
    date: "2030-01-07",
    timezone: "UTC",
  });
  await reportCheckIn._handler(context("alice"), {
    sessionId,
    outcome: "missed",
  });
  const firstPlan = await listSessions._handler(context("alice"), {});
  assert.equal(firstPlan.length, 2);
  await planning.planDay._handler(context("alice"), {
    date: "2030-01-07",
    timezone: "UTC",
  });
  assert.deepEqual(
    await listSessions._handler(context("alice"), {}),
    firstPlan
  );
  assert.equal((await db.get(taskId)).effortMinutes, undefined);
});

test("Remaining effort reduces the future plan while preserving unrelated and pinned Sessions", async (t) => {
  const now = Date.parse("2030-01-07T10:00Z");
  t.mock.method(Date, "now", () => now);
  const { db, context } = database();
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Read",
    valueKind: "number",
    progressMeasure: "quantity",
    currentNumValue: 0,
    completedNumValue: 200,
    effortMinutes: 180,
  });
  const otherTaskId = await db.insert("tasks", {
    userId: "alice",
    title: "Other",
    valueKind: "boolean",
    effortMinutes: 60,
  });
  const sessionId = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: now - 3600000,
    endAt: now,
  });
  const pinnedId = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: now + 3600000,
    endAt: now + 7200000,
    pinned: true,
    manualOverride: false,
  });
  await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: now + 7200000,
    endAt: now + 10800000,
    manualOverride: false,
  });
  const otherId = await db.insert("sessions", {
    userId: "alice",
    taskId: otherTaskId,
    startAt: now + 10800000,
    endAt: now + 14400000,
    manualOverride: false,
  });
  await planning.planDay._handler(context("alice"), {
    date: "2030-01-07",
    timezone: "UTC",
  });
  const other = structuredClone(await db.get(otherId));
  const pinned = structuredClone(await db.get(pinnedId));
  await reportCheckIn._handler(context("alice"), {
    sessionId,
    outcome: "progress",
    value: 30,
    timeMinutes: 20,
    remainingMinutes: 60,
  });
  assert.deepEqual(await db.get(otherId), other);
  assert.deepEqual(await db.get(pinnedId), pinned);
  const future = (await listSessions._handler(context("alice"), {})).filter(
    (s) => s.taskId === taskId && s.startAt > now
  );
  assert.equal(
    future.reduce((n, s) => n + (s.endAt - s.startAt) / 60000, 0),
    60
  );
  assert.equal((await db.get(taskId)).effortMinutes, 180);
  assert.equal((await db.get(taskId)).currentNumValue, 30);
});

test("Compact check-ins expand the queue on the right and Review opens the complete check-in Drawer", () => {
  const source = readFileSync(
    new URL(
      "../../../apps/web/src/features/tasks/session-check-ins.tsx",
      import.meta.url
    ),
    "utf8"
  );
  const file = ts.createSourceFile(
    "day-view.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const names = [
    "SessionCheckInTray",
    "CheckInCard",
    "CheckInDrawer",
    "SessionCheckIn",
  ];
  const code = file.statements
    .filter((s) => names.includes(s.name?.text))
    .map((s) => s.getText(file).replace(/^export /, ""))
    .join("\n");
  let states = [560, false];
  let stateIndex = 0;
  let opened;
  const scope = {
    React: {
      createElement: (type, props, ...children) => ({ type, props, children }),
    },
    useRef: () => ({ current: null }),
    useState: (initial) => {
      const index = stateIndex++;
      return [
        states[index] ?? initial,
        (value) => {
          states[index] = value;
        },
      ];
    },
    useEffect: () => {},
    useModal: () => ({
      openDrawer: (content) => {
        opened = content;
      },
    }),
    useMutation: () => ({ mutate: () => {}, isPending: false }),
    useConvexMutation: () => {},
    api: { sessions: { reportCheckIn: 0 } },
    m: new Proxy({}, { get: (_, key) => () => key }),
    Button: "Button",
    Check: "Check",
    Clock3: "Clock3",
    CircleSlash: "CircleSlash",
    TimerReset: "TimerReset",
    History: "History",
    Input: "Input",
    Drawer: "Drawer",
    ErrorSuspense: "ErrorSuspense",
    CheckInDetails: "CheckInDetails",
    TaskProgress: "TaskProgress",
  };
  const compiled = ts.transpileModule(code, {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const components = runInNewContext(
    compiled + "\n({" + names.join(",") + "})",
    scope
  );
  const sessions = Array.from({ length: 5 }, (_, i) => ({
    _id: `session-${i}`,
    taskTitle: `Read ${i}`,
    startAt: 1,
    endAt: 50,
    progressMeasure: "quantity",
    progressUnit: "pages",
  }));
  const tray = components.SessionCheckInTray({ sessions, timezone: "UTC" });
  const row = tray.children[1];
  const rowItems = row.children.flat().filter(Boolean);
  const queue = rowItems.at(-1);
  assert.equal(queue.type, "Button");
  assert.equal(queue.props["aria-label"], "check_in_queue");
  assert.equal(row.children[0].length, 2);
  queue.props.onClick();
  stateIndex = 0;
  const expanded = components.SessionCheckInTray({ sessions, timezone: "UTC" })
    .children[1];
  assert.match(expanded.props.className, /overflow-x-auto/);
  assert.equal(expanded.children[0].length, 5);
  const card = components.CheckInCard({
    session: sessions[0],
    timezone: "UTC",
    width: 232,
  });
  card.props.onClick({ target: { closest: () => null } });
  const drawer = opened.type(opened.props);
  assert.equal(drawer.type, "Drawer");
  assert.equal(drawer.children[0].type, "ErrorSuspense");
  assert.equal(drawer.children[0].children[0].props.sessionId, sessions[0]._id);
  states = [];
  stateIndex = 0;
  const details = components.SessionCheckIn({ session: sessions[0] });
  const text = (node) =>
    typeof node === "string"
      ? node
      : (node?.children ?? []).flat(Infinity).map(text).join(" ");
  const content = text(details);
  for (const label of [
    "pages",
    "check_in_time",
    "check_in_remaining",
    "check_in_progress",
    "check_in_missed",
    "check_in_working",
  ])
    assert.ok(content.includes(label), `${label} remains available in Review`);
});

test("Legacy Pages Tasks expose quantity units and persist a 43-page check-in", async () => {
  const { db, context } = database();
  const unitId = await db.insert("units", {
    userId: "alice",
    name: "Page",
    i18nKey: "units_page",
  });
  const taskTypeId = await db.insert("taskTypes", {
    userId: "alice",
    name: "Pages",
    valueKind: "number",
    unitId,
  });
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "test book",
    taskTypeId,
    valueKind: "number",
    initialNumValue: 0,
    currentNumValue: 0,
    completedNumValue: 523,
  });
  const sessionId = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: 1,
    endAt: 90,
  });
  const [session] = await listSessions._handler(context("alice"), {});
  assert.equal(session.progressMeasure, "quantity");
  assert.equal(session.progressUnit, "Page");
  await assert.rejects(
    reportCheckIn._handler(context("alice"), {
      sessionId,
      outcome: "progress",
    }),
    /Enter progress/
  );
  await reportCheckIn._handler(context("alice"), {
    sessionId,
    outcome: "progress",
    value: 43,
    timeMinutes: 30,
    remainingMinutes: 180,
  });
  assert.equal((await db.get(taskId)).currentNumValue, 43);
  assert.equal((await db.get(sessionId)).checkIn.value, 43);
  assert.equal((await db.get(sessionId)).checkIn.timeMinutes, 30);
});

test("A book check-in schedules remaining effort across future days and preserves those Sessions on reload", async (t) => {
  const now = Date.parse("2030-01-07T10:00Z");
  t.mock.method(Date, "now", () => now);
  const { db, context } = database();
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Read book",
    valueKind: "number",
    progressMeasure: "quantity",
    progressUnit: "pages",
    currentNumValue: 0,
    initialNumValue: 0,
    completedNumValue: 523,
    effortMinutes: 240,
  });
  await db.insert("planningSettings", {
    userId: "alice",
    timezone: "UTC",
    restrictAvailability: true,
    weekly: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      start: 600,
      end: 660,
    })),
    overrides: [],
    protectedWeekly: [],
    protectedDates: [],
  });
  const sessionId = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: now - 3600000,
    endAt: now,
  });
  await planning.planDay._handler(context("alice"), {
    date: "2030-01-07",
    timezone: "UTC",
  });
  await reportCheckIn._handler(context("alice"), {
    sessionId,
    outcome: "progress",
    value: 43,
    timeMinutes: 60,
    remainingMinutes: 180,
  });
  assert.equal((await db.get(taskId)).currentNumValue, 43);
  const first = await listSessions._handler(context("alice"), {});
  const planned = first.filter((s) => !s.checkIn);
  assert.equal(
    planned.reduce((sum, s) => sum + (s.endAt - s.startAt) / 60000, 0),
    180
  );
  assert.deepEqual(
    [
      ...new Set(
        planned.map((s) => localDateTime(s.startAt, "UTC").slice(0, 10))
      ),
    ],
    ["2030-01-07", "2030-01-08", "2030-01-09"]
  );
  await planning.planDay._handler(context("alice"), {
    date: "2030-01-08",
    timezone: "UTC",
  });
  assert.deepEqual(await listSessions._handler(context("alice"), {}), first);
});

test("Low-priority work gets at most one new Session per day", () => {
  const result = plan([task("reading", 180, { priority: "low" })], [], {
    settings: {
      ...autoSettings,
      weekly: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        start: 540,
        end: 720,
      })),
    },
  });
  const dates = result.changes
    .filter((c) => c.after)
    .map((c) => localDateTime(c.after.startAt, settings.timezone).slice(0, 10));
  assert.equal(dates.length, 3);
  assert.equal(new Set(dates).size, 3);
  assert.deepEqual(result.shortfalls, []);
});

test("Variety gives multiple Tasks Sessions before filling one Task's entire effort", () => {
  const result = plan([task("a", 180), task("b", 180)], [], {
    settings: {
      ...autoSettings,
      weekly: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        start: 540,
        end: 720,
      })),
    },
  });
  const firstDay = result.changes
    .filter(
      (c) =>
        c.after &&
        c.after.startAt < dayBounds("2030-01-08", settings.timezone).startAt
    )
    .sort((a, b) => a.after.startAt - b.after.startAt);
  assert.deepEqual(
    firstDay.slice(0, 2).map((c) => c.taskId),
    ["a", "b"]
  );
  assert.deepEqual(result.shortfalls, []);
});

test("An explicitly requested future check-in retains Session times and persists reported pages", async () => {
  const { requestCheckIn } = await import("../convex/sessions.ts");
  const { db, context } = database();
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Read",
    valueKind: "number",
    progressMeasure: "quantity",
    currentNumValue: 0,
    initialNumValue: 0,
    completedNumValue: 523,
  });
  const sessionId = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: 1000,
    endAt: 2000,
  });
  await assert.rejects(
    reportCheckIn._handler(context("alice"), {
      sessionId,
      outcome: "progress",
      value: 43,
    }),
    /not started/
  );
  await assert.rejects(
    requestCheckIn._handler(context("bob"), { sessionId }),
    /Session not found/
  );
  await requestCheckIn._handler(context("alice"), { sessionId });
  const session = await db.get(sessionId);
  assert.equal(session.startAt, 1000);
  assert.equal(session.endAt, 2000);
  assert.equal(session.checkInRequestedAt, 100);
  assert.equal((await db.get(taskId)).currentNumValue, 0);
  await reportCheckIn._handler(context("alice"), {
    sessionId,
    outcome: "progress",
    value: 43,
  });
  assert.equal((await db.get(taskId)).currentNumValue, 43);
});

test("Typing 43 pages in Review and clicking Made progress sends and persists that value", async () => {
  const { db, context } = database();
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Book",
    valueKind: "number",
    progressMeasure: "quantity",
    progressUnit: "pages",
    currentNumValue: 0,
    initialNumValue: 0,
    completedNumValue: 523,
  });
  const sessionId = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: 1,
    endAt: 90,
  });
  const [session] = await listSessions._handler(context("alice"), {});
  const source = readFileSync(
    new URL(
      "../../../apps/web/src/features/tasks/session-check-ins.tsx",
      import.meta.url
    ),
    "utf8"
  );
  const file = ts.createSourceFile(
    "day-view.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const fn = file.statements.find((s) => s.name?.text === "SessionCheckIn");
  const js = ts.transpileModule(fn.getText(file).replace(/^export /, ""), {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const states = [];
  let index = 0;
  let submitted;
  let saved;
  const scope = {
    React: {
      createElement: (type, props, ...children) => ({ type, props, children }),
    },
    useState: (initial) => {
      const slot = index++;
      return [
        states[slot] ?? initial,
        (value) => {
          states[slot] = value;
        },
      ];
    },
    useConvexMutation: () => (args) => {
      submitted = args;
      return reportCheckIn._handler(context("alice"), args);
    },
    useMutation: ({ mutationFn }) => ({
      isPending: false,
      mutate: (args) => {
        saved = mutationFn(args);
      },
    }),
    api: { sessions: { reportCheckIn: 0 } },
    m: new Proxy({}, { get: (_, key) => () => key }),
    Input: "Input",
    Button: "Button",
    TaskProgress: "TaskProgress",
  };
  const render = runInNewContext(js + "\nSessionCheckIn", scope);
  const elements = (node) => [
    node,
    ...(node?.children ?? [])
      .flat(Infinity)
      .flatMap((child) =>
        typeof child === "object" && child ? elements(child) : []
      ),
  ];
  const first = render({ session });
  const amount = elements(first).find((node) => node.type === "Input");
  amount.props.onChange({ target: { value: "43" } });
  index = 0;
  const filled = render({ session });
  const button = elements(filled).find(
    (node) =>
      node.type === "Button" && node.children.includes("check_in_progress")
  );
  assert.equal(button.props.disabled, false);
  button.props.onClick();
  await saved;
  assert.equal(submitted.value, 43);
  assert.equal(submitted.sessionId, sessionId);
  assert.equal((await db.get(taskId)).currentNumValue, 43);
  assert.equal((await db.get(sessionId)).checkIn.contribution, 43);
});

test("Waiting lower-priority Tasks get a turn across days without overriding pressing deadlines", () => {
  const result = plan(
    [
      task("high", 600, { priority: "high" }),
      task("low", 120, { priority: "low" }),
    ],
    [],
    {
      settings: {
        ...autoSettings,
        weekly: Array.from({ length: 7 }, (_, weekday) => ({
          weekday,
          start: 540,
          end: 600,
        })),
      },
    }
  );
  assert.ok(result.changes.some((c) => c.taskId === "low" && c.after));
  assert.equal(result.changes[0].taskId, "high");
  const due = plan(
    [
      task("urgent", 180, {
        priority: "low",
        dueAt: autoAt("12:00"),
        finishKind: "firm",
      }),
      task("other", 60),
    ],
    []
  );
  assert.equal(
    due.changes
      .filter((c) => c.taskId === "urgent" && c.after)
      .reduce((sum, c) => sum + (c.after.endAt - c.after.startAt) / 60000, 0),
    180
  );
});

function calendarInteractions(sessions = []) {
  const source = readFileSync(
    new URL(
      "../../../apps/web/src/features/tasks/day-view.tsx",
      import.meta.url
    ),
    "utf8"
  );
  const file = ts.createSourceFile(
    "day-view.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const view = file.statements.find((s) => s.name?.text === "DayView");
  const declarations = view.body.statements.flatMap((s) =>
    ts.isVariableStatement(s) ? [...s.declarationList.declarations] : []
  );
  const commit = declarations
    .find((d) => d.name.getText(file) === "commit")
    .initializer.arguments[0].getText(file);
  const effect = view.body.statements
    .find(
      (s) =>
        ts.isExpressionStatement(s) &&
        s.getText(file).includes('addEventListener("pointermove"')
    )
    .expression.arguments[0].getText(file);
  const functions = view.body.statements
    .filter(
      (s) =>
        ts.isFunctionDeclaration(s) &&
        ["begin", "handleCalendarClick"].includes(s.name.text)
    )
    .map((s) => s.getText(file))
    .join("\n");
  const callbacks = new Map();
  const result = { saved: [], opened: [], errors: [], captures: [] };
  const scope = {
    Date,
    MINUTE,
    PX: 1.4,
    start: 0,
    end: 1440 * MINUTE,
    dayMinutes: 1440,
    dragging: true,
    tasks: [],
    sessions,
    settings: null,
    events: [],
    suggestedStart: 540 * MINUTE,
    gesture: { current: null },
    pointer: { current: { x: 0, y: 0 } },
    suppressClick: { current: false },
    surface: {
      current: {
        getBoundingClientRect: () => ({
          left: 100,
          right: 500,
          top: 0,
          bottom: 2016,
        }),
      },
    },
    scroll: {
      current: {
        scrollTop: 0,
        getBoundingClientRect: () => ({
          left: 100,
          right: 500,
          top: 0,
          bottom: 2016,
        }),
      },
    },
    save: {
      isPending: false,
      mutate: (placement) => result.saved.push(placement),
    },
    setPending: () => {},
    setDrag: () => {},
    setInteractionError: (value) => result.errors.push(value),
    inspect: (placement) => result.opened.push(placement),
    openTask: (taskId) => result.opened.push(taskId),
    placementConflicts,
    adjustSession,
    snapMinutes: (n) => Math.round(n / 15) * 15,
    m: new Proxy({}, { get: (_, key) => () => key }),
    handlers: { current: {} },
    window: {
      addEventListener: (name, fn) => callbacks.set(name, fn),
      removeEventListener: (name) => callbacks.delete(name),
      setInterval: () => 1,
      clearInterval: () => {},
    },
  };
  const js = ts.transpileModule(
    functions +
      "\nconst commit = " +
      commit +
      ";\nconst attach = " +
      effect +
      ";",
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }
  ).outputText;
  const api = runInNewContext(
    js +
      '\n({begin, commit, attach, click: typeof handleCalendarClick === "undefined" ? undefined : handleCalendarClick})',
    scope
  );
  scope.handlers.current = {
    commit: api.commit,
    inspect: scope.inspect,
    openTask: scope.openTask,
  };
  const cleanup = api.attach();
  const event = (minute) => ({
    pointerId: 1,
    button: 0,
    clientX: 200,
    clientY: minute * 1.4,
    preventDefault: () => {},
    stopPropagation: () => {},
    currentTarget: { setPointerCapture: (id) => result.captures.push(id) },
  });
  return {
    ...result,
    begin: (kind, session, minute = 555) =>
      api.begin(event(minute), session.taskId, kind, session),
    move: (minute) => callbacks.get("pointermove")(event(minute)),
    finish: (minute) => callbacks.get("pointerup")(event(minute)),
    click: () => api.click?.(event(555), () => scope.inspect("click")),
    cleanup,
  };
}

test("Session details open from a regular click, never during pointerdown or pointerup", () => {
  const ui = calendarInteractions();
  const session = {
    _id: "s",
    taskId: "t",
    startAt: 540 * MINUTE,
    endAt: 600 * MINUTE,
  };
  ui.begin("move", session);
  ui.finish(555);
  assert.equal(ui.opened.length, 0);
  ui.click();
  assert.equal(ui.opened.length, 1);
  ui.cleanup();
});

test("Dragging onto a flexible automatic Session saves and replans instead of opening details", () => {
  const other = {
    _id: "other",
    taskId: "other-task",
    startAt: 600 * MINUTE,
    endAt: 660 * MINUTE,
    manualOverride: false,
  };
  const ui = calendarInteractions([other]);
  ui.begin("move", {
    _id: "s",
    taskId: "t",
    startAt: 540 * MINUTE,
    endAt: 600 * MINUTE,
  });
  ui.move(615);
  ui.finish(615);
  ui.click();
  assert.equal(ui.opened.length, 0);
  assert.equal(ui.saved.length, 1);
  assert.equal(ui.saved[0].startAt, 600 * MINUTE);
  ui.cleanup();
});

test("Dragging and both resize handles save only the intended time changes and suppress the trailing click", () => {
  const session = {
    _id: "s",
    taskId: "t",
    startAt: 540 * MINUTE,
    endAt: 600 * MINUTE,
  };
  for (const [kind, from, to, expectedStart, expectedEnd] of [
    ["move", 555, 585, 570, 630],
    ["start", 540, 555, 555, 600],
    ["end", 600, 630, 540, 630],
  ]) {
    const ui = calendarInteractions();
    ui.begin(kind, session, from);
    assert.deepEqual(ui.captures, [1]);
    ui.move(to);
    ui.finish(to);
    ui.click();
    assert.equal(ui.opened.length, 0);
    assert.equal(ui.saved.length, 1);
    assert.equal(ui.saved[0].startAt, expectedStart * MINUTE);
    assert.equal(ui.saved[0].endAt, expectedEnd * MINUTE);
    ui.cleanup();
  }
});

test("Blocked drops show a conflict without opening details; completed Sessions open only on click", () => {
  const session = {
    _id: "s",
    taskId: "t",
    startAt: 540 * MINUTE,
    endAt: 600 * MINUTE,
  };
  const ui = calendarInteractions([
    {
      _id: "pin",
      taskId: "other",
      taskTitle: "Pinned work",
      startAt: 600 * MINUTE,
      endAt: 660 * MINUTE,
      pinned: true,
      manualOverride: false,
    },
  ]);
  ui.begin("move", session);
  ui.move(615);
  ui.finish(615);
  ui.click();
  assert.equal(ui.opened.length, 0);
  assert.equal(ui.saved.length, 0);
  assert.match(ui.errors.at(-1), /Pinned work/);
  ui.cleanup();
  const completed = calendarInteractions();
  completed.begin("move", { ...session, taskCompletedAt: 42 });
  assert.equal(completed.opened.length, 0);
  completed.click();
  assert.equal(completed.opened.length, 1);
  completed.cleanup();
});

test("Batch completion deduplicates Tasks, reports every selected Session, and undoes atomically", async () => {
  const { batchCheckIn, undoBatchCheckIn } = await import(
    "../convex/sessions.ts"
  );
  const { db, context } = database();
  const book = await db.insert("tasks", {
    userId: "alice",
    title: "Book",
    valueKind: "number",
    progressMeasure: "quantity",
    initialNumValue: 0,
    currentNumValue: 0,
    completedNumValue: 523,
  });
  const mail = await db.insert("tasks", {
    userId: "alice",
    title: "Email",
    valueKind: "boolean",
    progressMeasure: "done",
  });
  const a = await db.insert("sessions", {
    userId: "alice",
    taskId: book,
    startAt: 1,
    endAt: 20,
  });
  const b = await db.insert("sessions", {
    userId: "alice",
    taskId: book,
    startAt: 21,
    endAt: 40,
  });
  const c = await db.insert("sessions", {
    userId: "alice",
    taskId: mail,
    startAt: 41,
    endAt: 60,
  });
  const other = await db.insert("sessions", {
    userId: "alice",
    taskId: mail,
    startAt: 61,
    endAt: 80,
  });
  const untouched = structuredClone(await db.get(other));
  const id = await batchCheckIn._handler(context("alice"), {
    sessionIds: [a, b, c, a],
    outcome: "finished",
  });
  assert.equal((await db.get(book)).currentNumValue, 523);
  assert.equal((await db.get(mail)).completedAt, 100);
  assert.equal(
    (await db.get(a)).checkIn.contribution +
      (await db.get(b)).checkIn.contribution,
    523
  );
  for (const sessionId of [a, b, c])
    assert.equal((await db.get(sessionId)).checkIn.outcome, "finished");
  assert.deepEqual(await db.get(other), untouched);
  await db.patch(book, { title: "New title" });
  const saved = await db.get(id);
  await db.patch(id, {
    tasks: JSON.parse(JSON.stringify(saved.tasks)),
    sessions: JSON.parse(JSON.stringify(saved.sessions)),
  });
  await undoBatchCheckIn._handler(context("alice"), { batchId: id });
  assert.equal((await db.get(book)).currentNumValue, 0);
  assert.equal((await db.get(book)).completedAt, undefined);
  assert.equal((await db.get(book)).title, "New title");
  assert.equal((await db.get(mail)).completedAt, undefined);
  for (const sessionId of [a, b, c])
    assert.equal((await db.get(sessionId)).checkIn, undefined);
  await undoBatchCheckIn._handler(context("alice"), { batchId: id });
  assert.deepEqual(await db.get(other), untouched);
});

test("A missed batch replans once and its undo restores unknown outcomes and the prior plan", async (t) => {
  const { batchCheckIn, undoBatchCheckIn } = await import(
    "../convex/sessions.ts"
  );
  const now = Date.parse("2030-01-07T10:00Z");
  t.mock.method(Date, "now", () => now);
  const { db, context } = database();
  const ids = [];
  for (const title of ["Book", "Email"]) {
    const taskId = await db.insert("tasks", {
      userId: "alice",
      title,
      valueKind: "boolean",
      effortMinutes: 60,
    });
    ids.push(
      await db.insert("sessions", {
        userId: "alice",
        taskId,
        startAt: now - 3600000,
        endAt: now,
      })
    );
  }
  await planning.planDay._handler(context("alice"), {
    date: "2030-01-07",
    timezone: "UTC",
  });
  const batchId = await batchCheckIn._handler(context("alice"), {
    sessionIds: ids,
    outcome: "missed",
  });
  assert.equal((await listSessions._handler(context("alice"), {})).length, 4);
  await undoBatchCheckIn._handler(context("alice"), { batchId });
  const restored = await listSessions._handler(context("alice"), {});
  assert.equal(restored.length, 2);
  assert.ok(restored.every((s) => s.checkIn === undefined));
});

test("Batch actions prevalidate every Session and enforce ownership without partial writes", async () => {
  const { batchCheckIn, undoBatchCheckIn } = await import(
    "../convex/sessions.ts"
  );
  const { db, context } = database();
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Book",
    valueKind: "boolean",
  });
  const a = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: 1,
    endAt: 30,
  });
  const future = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: 1000,
    endAt: 2000,
  });
  const foreign = await db.insert("sessions", {
    userId: "bob",
    taskId,
    startAt: 1,
    endAt: 30,
  });
  const before = structuredClone(await db.get(a));
  await assert.rejects(
    batchCheckIn._handler(context("alice"), {
      sessionIds: [a, future],
      outcome: "missed",
    }),
    /every selected/
  );
  await assert.rejects(
    batchCheckIn._handler(context("alice"), {
      sessionIds: [a, foreign],
      outcome: "finished",
    }),
    /Session not found/
  );
  assert.deepEqual(await db.get(a), before);
  const batchId = await batchCheckIn._handler(context("alice"), {
    sessionIds: [a],
    outcome: "later",
  });
  assert.equal((await db.get(a)).askAfter, 100 + 30 * 60000);
  assert.equal((await db.get(a)).checkIn, undefined);
  await assert.rejects(
    undoBatchCheckIn._handler(context("bob"), { batchId }),
    /Batch not found/
  );
  await undoBatchCheckIn._handler(context("alice"), { batchId });
  assert.equal((await db.get(a)).askAfter, undefined);
});

test("Batch undo preserves later progress corrections", async () => {
  const { batchCheckIn, undoBatchCheckIn } = await import(
    "../convex/sessions.ts"
  );
  const { db, context } = database();
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Book",
    valueKind: "number",
    progressMeasure: "quantity",
    initialNumValue: 0,
    currentNumValue: 0,
    completedNumValue: 523,
  });
  const sessionId = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: 1,
    endAt: 30,
  });
  const batchId = await batchCheckIn._handler(context("alice"), {
    sessionIds: [sessionId],
    outcome: "finished",
  });
  await reportCheckIn._handler(context("alice"), {
    sessionId,
    outcome: "progress",
    value: 43,
  });
  await assert.rejects(
    undoBatchCheckIn._handler(context("alice"), { batchId }),
    /progress changed/
  );
  assert.equal((await db.get(taskId)).currentNumValue, 43);
});

test("Session selection supports replacement, Ctrl toggles, Shift ranges and Ctrl-Shift unions", async () => {
  const { selectSessionRows } = await import(
    "../../../apps/web/src/features/tasks/day-calendar-layout.ts"
  );
  const rows = ["a", "b", "c", "d", "e"];
  let state = selectSessionRows(rows, new Set(), null, "b", false, false);
  state = selectSessionRows(
    rows,
    state.selected,
    state.anchor,
    "d",
    true,
    false
  );
  assert.deepEqual([...state.selected], ["b", "c", "d"]);
  state = selectSessionRows(
    rows,
    state.selected,
    state.anchor,
    "a",
    false,
    true
  );
  state = selectSessionRows(
    rows,
    state.selected,
    state.anchor,
    "b",
    false,
    true
  );
  assert.deepEqual([...state.selected], ["c", "d", "a"]);
  state = selectSessionRows(
    rows,
    state.selected,
    state.anchor,
    "e",
    true,
    true
  );
  assert.deepEqual([...state.selected], ["c", "d", "a", "b", "e"]);
  state = selectSessionRows(
    rows,
    state.selected,
    state.anchor,
    "a",
    false,
    false
  );
  assert.deepEqual([...state.selected], ["a"]);
});

test("Batch undo refuses to restore Sessions into a new fixed Event", async (t) => {
  const { batchCheckIn, undoBatchCheckIn } = await import(
    "../convex/sessions.ts"
  );
  const now = Date.parse("2030-01-07T10:00Z");
  t.mock.method(Date, "now", () => now);
  const { db, context } = database();
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Book",
    valueKind: "boolean",
    effortMinutes: 120,
  });
  const sessionId = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: now - 3600000,
    endAt: now,
  });
  const future = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: now + 3600000,
    endAt: now + 7200000,
    manualOverride: false,
  });
  await planning.planDay._handler(context("alice"), {
    date: "2030-01-07",
    timezone: "UTC",
  });
  const batchId = await batchCheckIn._handler(context("alice"), {
    sessionIds: [sessionId],
    outcome: "finished",
  });
  assert.notEqual((await db.get(future)).unscheduledAt, undefined);
  await planning.saveEvent._handler(context("alice"), {
    title: "Meeting",
    startAt: now + 3600000,
    endAt: now + 7200000,
    timezone: "UTC",
    attention: "focused",
  });
  await assert.rejects(
    undoBatchCheckIn._handler(context("alice"), { batchId }),
    /no longer feasible/
  );
  assert.equal((await db.get(taskId)).completedAt, now);
});

test("The review panel selects only matching Sessions and offers only universally supported actions", async () => {
  const { selectSessionRows } = await import(
    "../../../apps/web/src/features/tasks/day-calendar-layout.ts"
  );
  const { supportsBatchCheckIn } = await import(
    "../../validators/src/planning.ts"
  );
  const source = readFileSync(
    new URL(
      "../../../apps/web/src/features/tasks/session-check-ins.tsx",
      import.meta.url
    ),
    "utf8"
  );
  const file = ts.createSourceFile(
    "session-check-ins.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const fn = file.statements.find((s) => s.name?.text === "SessionReviewPanel");
  const js = ts.transpileModule(fn.getText(file).replace(/^export /, ""), {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const states = [];
  let index = 0;
  let sent;
  let completeCount;
  const scope = {
    React: {
      createElement: (type, props, ...children) => ({ type, props, children }),
    },
    useState: (initial) => {
      const slot = index++;
      return [
        states[slot] ?? initial,
        (value) => {
          states[slot] =
            typeof value === "function"
              ? value(states[slot] ?? initial)
              : value;
        },
      ];
    },
    useRef: () => ({ current: null }),
    useModal: () => ({ openDrawer: () => {} }),
    useQuery: () => ({ data: null }),
    convexQuery: () => {},
    useMutation: () => ({
      isPending: false,
      mutate: (args) => {
        sent = args;
      },
    }),
    useConvexMutation: () => {},
    api: {
      sessions: {
        batchCheckIn: 1,
        undoBatchCheckIn: 2,
        getLastCheckInBatch: 3,
      },
    },
    localDateTime,
    shiftDate: (date) => date,
    supportsBatchCheckIn,
    selectSessionRows,
    m: new Proxy(
      {
        check_in_complete_tasks: ({ count }) => {
          completeCount = count;
          return "completeTasks";
        },
      },
      { get: (target, key) => target[key] ?? (() => key) }
    ),
    Button: "Button",
    Checkbox: "Checkbox",
    Input: "Input",
    X: "X",
    CheckInDrawer: "CheckInDrawer",
  };
  const component = runInNewContext(js + "\nSessionReviewPanel", scope);
  const sessions = [
    { _id: "a", taskId: "book", taskTitle: "Book", startAt: 1, endAt: 30 },
    { _id: "b", taskId: "book", taskTitle: "Book", startAt: 31, endAt: 50 },
    {
      _id: "future",
      taskId: "other",
      taskTitle: "Other",
      startAt: 1000,
      endAt: 2000,
    },
  ];
  const elements = (node) => [
    node,
    ...(node?.children ?? [])
      .flat(Infinity)
      .flatMap((child) =>
        typeof child === "object" && child ? elements(child) : []
      ),
  ];
  const render = () => {
    index = 0;
    return elements(
      component({ sessions, timezone: "UTC", now: 100, onClose: () => {} })
    );
  };
  let nodes = render();
  nodes
    .find(
      (node) =>
        node.type === "Button" &&
        node.children.includes("check_in_select_matching")
    )
    .props.onClick();
  nodes = render();
  assert.equal(completeCount, 1);
  nodes
    .find(
      (node) =>
        node.type === "Button" && node.children.includes("check_in_missed")
    )
    .props.onClick();
  assert.deepEqual([...sent.sessionIds], ["b", "a"]);
  assert.equal(sent.outcome, "missed");
  states[0] = "all";
  nodes = render();
  nodes
    .find(
      (node) =>
        node.type === "Button" &&
        node.children.includes("check_in_select_matching")
    )
    .props.onClick();
  nodes = render();
  assert.equal(
    nodes.some(
      (node) =>
        node.type === "Button" && node.children.includes("completeTasks")
    ),
    false
  );
  assert.equal(
    nodes.some(
      (node) =>
        node.type === "Button" && node.children.includes("check_in_missed")
    ),
    false
  );
});

test("Batch undo respects a newly tightened Firm deadline", async (t) => {
  const { batchCheckIn, undoBatchCheckIn } = await import(
    "../convex/sessions.ts"
  );
  const now = Date.parse("2030-01-07T10:00Z");
  t.mock.method(Date, "now", () => now);
  const { db, context } = database();
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Book",
    valueKind: "boolean",
    effortMinutes: 120,
  });
  const sessionId = await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: now - 3600000,
    endAt: now,
  });
  await db.insert("sessions", {
    userId: "alice",
    taskId,
    startAt: now + 3600000,
    endAt: now + 7200000,
    manualOverride: false,
  });
  await planning.planDay._handler(context("alice"), {
    date: "2030-01-07",
    timezone: "UTC",
  });
  const batchId = await batchCheckIn._handler(context("alice"), {
    sessionIds: [sessionId],
    outcome: "finished",
  });
  await db.patch(taskId, { finishKind: "firm", dueAt: now + 1800000 });
  await assert.rejects(
    undoBatchCheckIn._handler(context("alice"), { batchId }),
    /no longer feasible/
  );
  assert.equal((await db.get(taskId)).completedAt, now);
});

const recurringRule = {
  kind: "calendar",
  unit: "day",
  interval: 1,
  startDate: "2030-01-07",
  time: "09:00",
  timezone: "Europe/Prague",
  weekStartsOn: 1,
  count: 3,
  volume: 150,
  carryForward: false,
};

async function recurringFixture(t, overrides = {}) {
  let now = zonedInstant("2030-01-07T08:00", "Europe/Prague");
  t.mock.method(Date, "now", () => now);
  const store = database();
  const { db, context, rows } = store;
  const taskTypeId = await db.insert("taskTypes", {
    userId: "alice",
    valueKind: "boolean",
  });
  const priorityClassId = await db.insert("priorityClasses", {
    userId: "alice",
  });
  const tagId = await db.insert("tags", { userId: "alice", name: "Sport" });
  const rule = { ...recurringRule, ...overrides };
  const seriesId = await tasks.create._handler(context("alice"), {
    title: "Exercise",
    taskTypeId,
    priorityClassId,
    tags: [tagId],
    progressMeasure: "time",
    completedNumValue: 30,
    effortMinutes: 30,
    recurrence: rule,
  });
  return {
    ...store,
    rule,
    seriesId,
    priorityClassId,
    now: (value) => {
      now = zonedInstant(value, rule.timezone);
    },
    occurrences: () =>
      [...rows.values()].filter((row) => row.seriesId === seriesId),
    sync: () => syncOccurrences({ ...context("alice"), userId: "alice" }),
    edit: (taskId, values = {}) =>
      tasks.update._handler(context("alice"), {
        taskId,
        title: "Edited exercise",
        priorityClassId,
        tags: [tagId],
        progressMeasure: "time",
        completedNumValue: 30,
        effortMinutes: 30,
        recurrence: rule,
        ...values,
      }),
  };
}

test("Recurrence follows local DST time, configured calendar weeks, and clamped month ends", () => {
  const spring = recurrenceWindows(
    { ...recurringRule, startDate: "2026-03-28", time: "02:30" },
    "2026-03-28",
    "2026-03-30"
  );
  assert.equal(
    localDateTime(spring[0].startAt, "Europe/Prague"),
    "2026-03-28T02:30"
  );
  assert.equal(
    localDateTime(spring[1].startAt, "Europe/Prague"),
    "2026-03-29T03:30"
  );
  assert.equal(
    localDateTime(spring[2].startAt, "Europe/Prague"),
    "2026-03-30T02:30"
  );
  const fall = recurrenceWindows(
    { ...recurringRule, startDate: "2026-10-25", time: "02:30" },
    "2026-10-25",
    "2026-10-25"
  )[0];
  assert.equal(
    fall.startAt,
    zonedInstant("2026-10-25T02:30", "Europe/Prague", "earlier")
  );
  assert.equal(recurrenceDate("2028-01-31", "month", 1), "2028-02-29");
  assert.equal(recurrenceDate("2028-01-31", "month", 2), "2028-03-31");
  const monday = recurrenceWindows(
    { ...recurringRule, kind: "frequency", unit: "week", endAfter: 3 },
    "2030-01-07",
    "2030-01-20"
  );
  assert.equal(monday.length, 3);
  assert.equal(
    localDateTime(monday[0].endAt, "Europe/Prague"),
    "2030-01-14T00:00"
  );
  const sunday = recurrenceWindows(
    {
      ...recurringRule,
      kind: "frequency",
      unit: "week",
      weekStartsOn: 0,
      endDate: "2030-01-08",
    },
    "2030-01-07",
    "2030-01-20"
  );
  assert.equal(
    localDateTime(sunday[0].endAt, "Europe/Prague"),
    "2030-01-09T00:00"
  );
  for (const patch of [
    { interval: 0 },
    { count: 1.5 },
    { weekStartsOn: 7 },
    { endAfter: 0 },
    { timezone: "invalid" },
    { endDate: "2029-12-31" },
  ])
    assert.throws(() => validateRecurrence({ ...recurringRule, ...patch }));
});

test("Recurring Tasks persist independent Occurrences, copied tags, Sessions and progress without duplicate generation", async (t) => {
  const f = await recurringFixture(t, { endAfter: 3 });
  await f.sync();
  assert.equal(f.occurrences().length, 3);
  const [first, second] = f.occurrences();
  const sessionId = await saveSession._handler(f.context("alice"), {
    taskId: first._id,
    startAt: first.occurrenceStartAt,
    endAt: first.occurrenceStartAt + 30 * 60000,
  });
  f.now("2030-01-07T10:00");
  await reportCheckIn._handler(f.context("alice"), {
    sessionId,
    outcome: "progress",
    value: 12,
    timeMinutes: 15,
  });
  assert.equal((await f.db.get(first._id)).currentNumValue, 12);
  assert.equal((await f.db.get(second._id)).currentNumValue, 0);
  await reportCheckIn._handler(f.context("alice"), {
    sessionId,
    outcome: "finished",
    timeMinutes: 30,
  });
  assert.ok((await f.db.get(first._id)).completedAt);
  assert.equal((await f.db.get(second._id)).completedAt, undefined);
  assert.equal((await f.db.get(f.seriesId)).completedAt, undefined);
  assert.equal(f.occurrences().length, 3);
  assert.equal(
    [...f.rows.values()].filter((row) => row.taskId === second._id && row.tagId)
      .length,
    1
  );
  await assert.rejects(
    saveSession._handler(f.context("bob"), {
      taskId: second._id,
      startAt: second.occurrenceStartAt,
      endAt: second.occurrenceStartAt + 60000,
    })
  );
  await assert.rejects(f.edit(second._id, { priorityClassId: "someone-else" }));
});

test("Missed Occurrences expire without losing partial results, while carry-forward keeps independent unfinished work", async (t) => {
  const f = await recurringFixture(t, { endAfter: 3 });
  const first = f.occurrences()[0];
  await f.db.patch(first._id, { currentNumValue: 12 });
  f.now("2030-01-08T08:00");
  await f.sync();
  assert.ok((await f.db.get(first._id)).expiredAt);
  assert.equal((await f.db.get(first._id)).currentNumValue, 12);
  assert.equal((await f.db.get(first._id)).completedAt, undefined);
  assert.equal(f.occurrences().length, 3);
  const carried = await recurringFixture(t, {
    carryForward: true,
    endAfter: 3,
  });
  const old = carried.occurrences()[0];
  await carried.db.patch(old._id, { currentNumValue: 10 });
  carried.now("2030-01-09T08:00");
  await carried.sync();
  assert.equal((await carried.db.get(old._id)).expiredAt, undefined);
  assert.equal((await carried.db.get(old._id)).currentNumValue, 10);
  assert.equal(carried.occurrences().length, 3);
});

test("Weekly frequency creates distinct Occurrences and volume accumulates across Sessions", async (t) => {
  const f = await recurringFixture(t, {
    kind: "frequency",
    unit: "week",
    endAfter: 3,
  });
  assert.equal(f.occurrences().length, 3);
  assert.equal(
    new Set(f.occurrences().map((o) => o.occurrenceStartAt)).size,
    1
  );
  const v = await recurringFixture(t, {
    kind: "volume",
    unit: "week",
    endAfter: 1,
  });
  const occurrence = v.occurrences()[0];
  assert.equal(occurrence.completedNumValue, 150);
  const ids = [];
  for (const hour of [9, 10])
    ids.push(
      await saveSession._handler(v.context("alice"), {
        taskId: occurrence._id,
        startAt: occurrence.occurrenceStartAt + (hour - 9) * 3600000,
        endAt: occurrence.occurrenceStartAt + (hour - 9) * 3600000 + 30 * 60000,
      })
    );
  v.now("2030-01-07T11:00");
  for (const sessionId of ids)
    await reportCheckIn._handler(v.context("alice"), {
      sessionId,
      outcome: "progress",
      value: 75,
      timeMinutes: 30,
    });
  assert.equal((await v.db.get(occurrence._id)).currentNumValue, 150);
  assert.ok((await v.db.get(occurrence._id)).completedAt);
  assert.equal((await v.db.get(ids[0])).checkIn.timeMinutes, 30);
});

test("Occurrence-only and this-and-future edits preserve history and explicit exceptions", async (t) => {
  const f = await recurringFixture(t, { endAfter: 4 });
  const [past, current, exception, future] = f.occurrences();
  await f.edit(exception._id, {
    editScope: "occurrence",
    title: "Special workout",
  });
  f.now("2030-01-08T08:00");
  await f.edit(current._id, { title: "New workout" });
  assert.equal((await f.db.get(past._id)).title, "Exercise");
  assert.equal((await f.db.get(current._id)).title, "New workout");
  assert.equal((await f.db.get(exception._id)).title, "Special workout");
  assert.equal((await f.db.get(future._id)).title, "New workout");
  assert.equal((await f.db.get(f.seriesId)).title, "New workout");
  await f.edit(current._id, { recurrence: { ...f.rule, time: "11:00" } });
  assert.equal(
    localDateTime(
      (await f.db.get(current._id)).occurrenceStartAt,
      f.rule.timezone
    ),
    "2030-01-08T11:00"
  );
  const active = f.occurrences().filter((o) => o.archivedAt === undefined);
  assert.equal(
    active.filter((o) =>
      localDateTime(o.occurrenceStartAt, f.rule.timezone).startsWith(
        "2030-01-09"
      )
    ).length,
    1
  );
  assert.equal(
    active.filter(
      (o) =>
        localDateTime(o.occurrenceStartAt, f.rule.timezone) ===
        "2030-01-10T11:00"
    ).length,
    1
  );
  assert.equal((await f.db.get(exception._id)).title, "Special workout");
  await f.sync();
  assert.equal(
    f.occurrences().filter((o) => o.archivedAt === undefined).length,
    active.length
  );
});

test("Completion-based intervals start from actual completion, and undo withdraws the dependent future Occurrence", async (t) => {
  const f = await recurringFixture(t, {
    kind: "completion",
    interval: 2,
    endAfter: 2,
  });
  assert.equal(f.occurrences().length, 1);
  const first = f.occurrences()[0];
  const sessionId = await saveSession._handler(f.context("alice"), {
    taskId: first._id,
    startAt: first.occurrenceStartAt,
    endAt: first.occurrenceStartAt + 30 * 60000,
  });
  f.now("2030-01-08T12:45");
  await reportCheckIn._handler(f.context("alice"), {
    sessionId,
    outcome: "finished",
  });
  assert.equal(f.occurrences().length, 2);
  const second = f.occurrences().find((o) => o._id !== first._id);
  assert.equal(
    localDateTime(second.occurrenceStartAt, f.rule.timezone),
    "2030-01-10T12:45"
  );
  await reportCheckIn._handler(f.context("alice"), {
    sessionId,
    outcome: "undo",
  });
  assert.ok((await f.db.get(second._id)).archivedAt);
  await f.sync();
  assert.equal(
    f.occurrences().filter((o) => o.archivedAt === undefined).length,
    1
  );
});

test("Automatic and manual placement respect Occurrence windows and leave series templates unscheduled", async (t) => {
  const f = await recurringFixture(t, { endAfter: 2 });
  await planning.planDay._handler(f.context("alice"), {
    date: "2030-01-07",
    timezone: f.rule.timezone,
  });
  const sessions = [...f.rows.values()].filter(
    (r) => r._id.startsWith("sessions-") && r.unscheduledAt === undefined
  );
  assert.ok(sessions.length > 0);
  for (const s of sessions) {
    const o = await f.db.get(s.taskId);
    assert.notEqual(o._id, f.seriesId);
    assert.ok(s.startAt >= o.occurrenceStartAt);
    assert.ok(s.endAt <= o.occurrenceEndAt);
  }
  const next = f.occurrences()[1];
  await assert.rejects(
    saveSession._handler(f.context("alice"), {
      taskId: next._id,
      startAt: next.occurrenceStartAt - 3600000,
      endAt: next.occurrenceStartAt + 60000,
      allowConflict: true,
    })
  );
  await assert.rejects(
    saveSession._handler(f.context("alice"), {
      taskId: next._id,
      startAt: next.occurrenceEndAt,
      endAt: next.occurrenceEndAt + 60000,
      allowConflict: true,
    })
  );
});

test("No-end recurrence materializes only the current and requested windows, without filling intervening years", async (t) => {
  const f = await recurringFixture(t);
  assert.ok(f.occurrences().length <= 8);
  await syncOccurrences(
    { ...f.context("alice"), userId: "alice" },
    "2040-01-01"
  );
  assert.ok(f.occurrences().length <= 16);
  const count = f.occurrences().length;
  await syncOccurrences(
    { ...f.context("alice"), userId: "alice" },
    "2040-01-01"
  );
  assert.equal(f.occurrences().length, count);
  assert.ok(
    f
      .occurrences()
      .some((o) =>
        localDateTime(o.occurrenceStartAt, f.rule.timezone).startsWith("2040")
      )
  );
  assert.ok(
    !f
      .occurrences()
      .some((o) =>
        localDateTime(o.occurrenceStartAt, f.rule.timezone).startsWith("2035")
      )
  );
});

test("Recurrence uses calendar Settings across Tasks, including after timezone and week-start changes", async (t) => {
  const f = await recurringFixture(t, {
    kind: "frequency",
    unit: "week",
    endAfter: 6,
  });
  await f.edit(f.seriesId, {
    recurrence: { ...f.rule, timezone: "America/New_York", weekStartsOn: 0 },
  });
  assert.equal(
    (await f.db.get(f.seriesId)).recurrence.timezone,
    "Europe/Prague"
  );
  assert.equal((await f.db.get(f.seriesId)).recurrence.weekStartsOn, 1);
  await planning.saveSettings._handler(f.context("alice"), {
    timezone: "America/New_York",
    weekStartsOn: 0,
    weekly: [],
    overrides: [],
    protectedWeekly: [],
    protectedDates: [],
  });
  assert.equal(
    (await f.db.get(f.seriesId)).recurrence.timezone,
    "America/New_York"
  );
  assert.equal((await f.db.get(f.seriesId)).recurrence.weekStartsOn, 0);
  const pending = f
    .occurrences()
    .filter(
      (o) => o.archivedAt === undefined && o.occurrenceStartAt > Date.now()
    );
  assert.ok(pending.length);
  for (const occurrence of pending) {
    assert.equal(
      localDateTime(occurrence.occurrenceStartAt, "America/New_York").slice(11),
      "09:00"
    );
    assert.equal(
      new Date(
        localDateTime(occurrence.occurrenceEndAt, "America/New_York").slice(
          0,
          10
        ) + "T12:00Z"
      ).getUTCDay(),
      0
    );
  }
  assert.throws(
    () =>
      validateRecurrence({
        ...recurringRule,
        endDate: "2030-02-01",
        endAfter: 5,
      }),
    /either/
  );
});

test("Volume recurrence inherits the selected numeric Task type's units and target", async (t) => {
  const f = await recurringFixture(t);
  const unitId = await f.db.insert("units", {
    name: "Pages",
    symbol: "pages",
    i18nKey: "units_page",
  });
  const taskTypeId = await f.db.insert("taskTypes", {
    userId: "alice",
    valueKind: "number",
    unitId,
    initialNumValue: 0,
    completedNumValue: 20,
  });
  const seriesId = await tasks.create._handler(f.context("alice"), {
    title: "Read",
    taskTypeId,
    priorityClassId: f.priorityClassId,
    tags: [],
    recurrence: { ...f.rule, kind: "volume", volume: 100, endAfter: 1 },
  });
  const occurrence = [...f.rows.values()].find(
    (row) => row.seriesId === seriesId
  );
  assert.equal(occurrence.progressMeasure, "quantity");
  assert.equal(occurrence.progressUnit, "pages");
  assert.equal(occurrence.completedNumValue, 100);
});

test("Two-minute recurring Tasks are scheduled at their actual duration and remain stable on replanning", async (t) => {
  const f = await recurringFixture(t, { endAfter: 3 });
  await f.edit(f.seriesId, { effortMinutes: 2 });
  const selection = { date: "2030-01-07", timezone: f.rule.timezone };
  await planning.planDay._handler(f.context("alice"), selection);
  const scheduled = () =>
    [...f.rows.values()].filter(
      (r) => r._id.startsWith("sessions-") && r.unscheduledAt === undefined
    );
  assert.equal(scheduled().length, 3);
  for (const session of scheduled())
    assert.equal((session.endAt - session.startAt) / 60000, 2);
  const before = scheduled().map((s) => [
    s._id,
    s.startAt,
    s.endAt,
    s.revision,
  ]);
  await planning.planDay._handler(f.context("alice"), selection);
  assert.deepEqual(
    scheduled().map((s) => [s._id, s.startAt, s.endAt, s.revision]),
    before
  );
});

test("The Day panel shows one entry per recurring series on every Day", async (t) => {
  const f = await recurringFixture(t, { endAfter: 3 });
  const page = await tasks.listForDayPanel._handler(f.context("alice"), {
    search: "",
    paginationOpts: { cursor: null, numItems: 30 },
  });
  assert.equal(page.page.length, 1);
  assert.equal(page.page[0]._id, f.seriesId);
  assert.equal(page.page[0].recurring, true);
  const future = await tasks.listForDayPanel._handler(f.context("alice"), {
    search: "Exercise",
    paginationOpts: { cursor: null, numItems: 30 },
  });
  assert.deepEqual(
    future.page.map((task) => task._id),
    [f.seriesId]
  );
});

test("Dropping a recurring series selects the target Day's Occurrence and moves an existing Session without duplication", async (t) => {
  const f = await recurringFixture(t, { endAfter: 3 });
  await f.edit(f.seriesId, { effortMinutes: 2 });
  const at = (local) => zonedInstant(local, f.rule.timezone);
  const sessionId = await saveSession._handler(f.context("alice"), {
    taskId: f.seriesId,
    startAt: at("2030-01-08T10:00"),
    endAt: at("2030-01-08T10:02"),
  });
  const session = await f.db.get(sessionId);
  const occurrence = await f.db.get(session.taskId);
  assert.equal(occurrence.seriesId, f.seriesId);
  assert.equal(
    localDateTime(occurrence.occurrenceStartAt, f.rule.timezone).slice(0, 10),
    "2030-01-08"
  );
  const movedId = await saveSession._handler(f.context("alice"), {
    taskId: f.seriesId,
    startAt: at("2030-01-08T11:00"),
    endAt: at("2030-01-08T11:02"),
  });
  assert.equal(movedId, sessionId);
  assert.equal((await f.db.get(sessionId)).startAt, at("2030-01-08T11:00"));
  assert.equal(
    [...f.rows.values()].filter(
      (row) =>
        row._id.startsWith("sessions-") && row.unscheduledAt === undefined
    ).length,
    1
  );
  await assert.rejects(
    saveSession._handler(f.context("alice"), {
      taskId: f.seriesId,
      startAt: at("2030-01-20T10:00"),
      endAt: at("2030-01-20T10:02"),
    }),
    /no unfinished Occurrence/
  );
  await assert.rejects(
    saveSession._handler(f.context("bob"), {
      taskId: f.seriesId,
      startAt: at("2030-01-08T12:00"),
      endAt: at("2030-01-08T12:02"),
    })
  );
});

test("Scheduling a series resumes the selected Occurrence and frequency drops use distinct Occurrences first", async (t) => {
  const f = await recurringFixture(t, {
    kind: "frequency",
    unit: "week",
    endAfter: 3,
  });
  await f.edit(f.seriesId, { effortMinutes: 2 });
  const ids = [];
  for (const hour of [10, 11, 12]) {
    const startAt = zonedInstant("2030-01-08T" + hour + ":00", f.rule.timezone);
    ids.push(
      await saveSession._handler(f.context("alice"), {
        taskId: f.seriesId,
        startAt,
        endAt: startAt + 2 * 60000,
      })
    );
  }
  assert.equal(
    new Set(
      await Promise.all(ids.map(async (id) => (await f.db.get(id)).taskId))
    ).size,
    3
  );
  const selected = (await f.db.get(ids[0])).taskId;
  await f.db.patch(selected, { automaticSchedulingPaused: true });
  await planning.scheduleTask._handler(f.context("alice"), {
    taskId: f.seriesId,
    date: "2030-01-08",
    timezone: f.rule.timezone,
  });
  assert.equal((await f.db.get(selected)).automaticSchedulingPaused, false);
});

async function mailFixture() {
  const f = database();
  const ctx = f.context("alice");
  const taskTypeId = await f.db.insert("taskTypes", {
    userId: "alice",
    valueKind: "boolean",
  });
  const priorityClassId = await f.db.insert("priorityClasses", {
    userId: "alice",
  });
  const permissions = {
    account: "alice@gmail.com",
    labelId: "INBOX",
    labelName: "Inbox",
    bodies: true,
    threadContext: true,
    attachments: false,
    excluded: false,
    aiAllowed: false,
  };
  const sourceId = await mail.saveSource._handler(ctx, permissions);
  const action = {
    sourceId,
    taskTypeId,
    priorityClassId,
    messageId: "message-1",
    threadId: "thread-1",
    actionKey: "request-1",
    kind: "reply",
    title: "Confirm attendance",
    missingInputs: ["arrival time"],
    excerpt: "Please confirm",
    suggestedReply: "I can attend.",
  };
  return {
    ...f,
    ctx,
    sourceId,
    taskTypeId,
    priorityClassId,
    permissions,
    action,
  };
}

test("Mail actions are idempotent per account/thread/action, preserve planning and progress, and allow multiple independent requests", async () => {
  const f = await mailFixture();
  const id = await mail.saveAction._handler(f.ctx, f.action);
  await f.db.patch(id, {
    effortMinutes: 45,
    priority: "high",
    completedAt: 50,
    title: "My edited title",
  });
  const sessionId = await f.db.insert("sessions", {
    userId: "alice",
    taskId: id,
    startAt: 1000,
    endAt: 2000,
    pinned: true,
  });
  assert.equal(
    await mail.saveAction._handler(f.ctx, {
      ...f.action,
      messageId: "message-2",
      excerpt: "Updated request",
    }),
    id
  );
  const task = await f.db.get(id);
  assert.equal(task.completedAt, 50);
  assert.equal(task.effortMinutes, 45);
  assert.equal(task.priority, "high");
  assert.equal(task.title, "My edited title");
  assert.equal((await f.db.get(sessionId)).pinned, true);
  const details = await mail.taskDetails._handler(f.ctx, { taskId: id });
  assert.equal(details.messageId, "message-2");
  assert.match(details.suggestedReply, /\[INPUT NEEDED: arrival time\]/);
  assert.equal(details.excerpt, "Updated request");
  const second = await mail.saveAction._handler(f.ctx, {
    ...f.action,
    actionKey: "request-2",
    kind: "action",
  });
  assert.notEqual(second, id);
  const unrelated = await mail.saveAction._handler(f.ctx, {
    ...f.action,
    threadId: "unrelated-thread",
  });
  assert.notEqual(unrelated, id);
  const label = await mail.saveSource._handler(f.ctx, {
    ...f.permissions,
    labelId: "Label_1",
    labelName: "Personal",
  });
  assert.equal(
    await mail.saveAction._handler(f.ctx, { ...f.action, sourceId: label }),
    id
  );
  assert.equal(
    (
      await mail.actionsForThread._handler(f.ctx, {
        sourceId: label,
        threadId: "thread-1",
      })
    ).length,
    2
  );
});

test("Mail permission revocation clears derived content, blocks excluded sources and enforces user ownership", async () => {
  const f = await mailFixture();
  const id = await mail.saveAction._handler(f.ctx, f.action);
  await mail.saveSource._handler(f.ctx, {
    ...f.permissions,
    sourceId: f.sourceId,
    bodies: false,
  });
  const details = await mail.taskDetails._handler(f.ctx, { taskId: id });
  assert.equal(details.excerpt, undefined);
  assert.equal(details.suggestedReply, undefined);
  await assert.rejects(mail.saveAction._handler(f.ctx, f.action));
  const reply = await mail.saveAction._handler(f.ctx, {
    ...f.action,
    actionKey: "metadata-reply",
    excerpt: undefined,
    suggestedReply: undefined,
    missingInputs: [],
  });
  assert.equal(
    (await mail.taskDetails._handler(f.ctx, { taskId: reply })).suggestedReply,
    undefined
  );
  await assert.rejects(
    mail.actionsForThread._handler(f.context("bob"), {
      sourceId: f.sourceId,
      threadId: "thread-1",
    })
  );
  await assert.rejects(mail.saveAction._handler(f.context("bob"), f.action));
  await assert.rejects(
    mail.taskDetails._handler(f.context("bob"), { taskId: id })
  );
  await assert.rejects(mail.list._handler(f.context(null), {}));
  await mail.saveSource._handler(f.ctx, {
    ...f.permissions,
    sourceId: f.sourceId,
    excluded: true,
  });
  await assert.rejects(mail.saveAction._handler(f.ctx, f.action));
  assert.equal((await f.db.get(id)).completedAt, undefined);
});

test("Mail routines use weekday and weekly defaults, freeze batches across starts and retain manual fallback after disconnection", async () => {
  const f = await mailFixture();
  const seriesId = await mail.createRoutine._handler(f.ctx, {
    sourceId: f.sourceId,
    kind: "inbox",
    taskTypeId: f.taskTypeId,
    priorityClassId: f.priorityClassId,
    timezone: "Europe/Prague",
    batchSize: 2,
  });
  const series = await f.db.get(seriesId);
  assert.equal(series.effortMinutes, 15);
  assert.equal(series.priority, "normal");
  assert.equal(series.dueAt, undefined);
  assert.equal(series.recurrence.carryForward, false);
  assert.deepEqual(series.recurrence.weekdays, [1, 2, 3, 4, 5]);
  const occurrences = [...f.rows.values()].filter(
    (r) => r.seriesId === seriesId
  );
  assert.ok(occurrences.length > 0);
  assert.ok(
    occurrences.every(
      (o) =>
        ![0, 6].includes(
          new Date(
            localDateTime(o.occurrenceStartAt, "Europe/Prague").slice(0, 10) +
              "T12:00Z"
          ).getUTCDay()
        )
    )
  );
  const taskId = occurrences[0]._id;
  await mail.startBatch._handler(f.ctx, {
    taskId,
    messageIds: ["one", "two"],
    manual: false,
  });
  await mail.startBatch._handler(f.ctx, {
    taskId,
    messageIds: ["new"],
    manual: false,
  });
  assert.deepEqual((await mail.batch._handler(f.ctx, { taskId })).messageIds, [
    "one",
    "two",
  ]);
  await mail.reviewMessage._handler(f.ctx, { taskId, messageId: "one" });
  await mail.reviewMessage._handler(f.ctx, { taskId, messageId: "one" });
  assert.deepEqual((await mail.batch._handler(f.ctx, { taskId })).reviewedIds, [
    "one",
  ]);
  await assert.rejects(
    mail.reviewMessage._handler(f.ctx, { taskId, messageId: "new" })
  );
  assert.equal((await f.db.get(taskId)).completedAt, undefined);
  const spam = await mail.createRoutine._handler(f.ctx, {
    kind: "spam",
    taskTypeId: f.taskTypeId,
    priorityClassId: f.priorityClassId,
    timezone: "Europe/Prague",
    batchSize: 25,
  });
  assert.equal((await f.db.get(spam)).effortMinutes, 10);
  assert.equal((await f.db.get(spam)).recurrence.unit, "week");
  await mail.disconnect._handler(f.ctx, {
    sourceId: f.sourceId,
    routines: "manual",
  });
  assert.equal((await f.db.get(taskId)).mailSourceId, undefined);
  assert.equal((await f.db.get(seriesId)).archivedAt, undefined);
  await mail.startBatch._handler(f.ctx, {
    taskId: occurrences[1]._id,
    messageIds: [],
    manual: true,
  });
  assert.equal(
    (await mail.batch._handler(f.ctx, { taskId: occurrences[1]._id })).manual,
    true
  );
});

test("Weekday recurrence counts selected dates in endAfter and follows local dates through daylight saving", () => {
  const rule = {
    kind: "calendar",
    unit: "day",
    interval: 1,
    startDate: "2030-03-29",
    time: "09:00",
    timezone: "Europe/Prague",
    weekStartsOn: 1,
    count: 1,
    volume: 1,
    carryForward: false,
    weekdays: [1, 2, 3, 4, 5],
    endAfter: 3,
  };
  const windows = recurrenceWindows(rule, "2030-03-29", "2030-04-05");
  assert.deepEqual(
    windows.map((w) => w.date),
    ["2030-03-29", "2030-04-01", "2030-04-02"]
  );
  assert.ok(
    windows.every(
      (w) => localDateTime(w.startAt, rule.timezone).slice(11, 16) === "09:00"
    )
  );
  assert.throws(() => validateRecurrence({ ...rule, weekdays: [] }));
  assert.throws(() => validateRecurrence({ ...rule, weekdays: [8] }));
});

test("Stopping mail routines preserves completed history and cancels only future Occurrences", async () => {
  const f = await mailFixture();
  const seriesId = await mail.createRoutine._handler(f.ctx, {
    sourceId: f.sourceId,
    kind: "inbox",
    taskTypeId: f.taskTypeId,
    priorityClassId: f.priorityClassId,
    timezone: "UTC",
    batchSize: 25,
  });
  const occurrences = [...f.rows.values()].filter(
    (r) => r.seriesId === seriesId
  );
  const completed = occurrences[0];
  await f.db.patch(completed._id, { completedAt: 50 });
  await mail.disconnect._handler(f.ctx, {
    sourceId: f.sourceId,
    routines: "stop",
  });
  assert.equal((await f.db.get(completed._id)).archivedAt, undefined);
  assert.equal((await f.db.get(completed._id)).completedAt, 50);
  assert.ok((await f.db.get(seriesId)).archivedAt !== undefined);
  for (const occurrence of occurrences
    .slice(1)
    .filter((o) => o.occurrenceStartAt > 100))
    assert.ok((await f.db.get(occurrence._id)).archivedAt !== undefined);
});
