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
const planning = await import("../convex/planning.ts");
const calendars = await import("../convex/calendars.ts");
const { calendarEvent } = await import("../convex/utils/calendarImport.ts");
const projects = await import("../convex/projects.ts");
const {
  availabilityOn,
  dayBounds,
  eventsCompatible,
  localDateTime,
  placementConflicts,
  projectAllDayEvent,
  validatePlanning,
  zonedInstant,
} = await import("../../validators/src/planning.ts");
const { planSessions } = await import("../../validators/src/auto-planning.ts");
const { planTravel, locationConflicts } = await import(
  "../../validators/src/travel.ts"
);
const { recurrenceWindows, recurrenceDate, validateRecurrence } = await import(
  "../../validators/src/recurrence.ts"
);
const { syncOccurrences } = await import("../convex/utils/recurrence.ts");

function featureRenderer(filename, name, scope) {
  const source = readFileSync(
    new URL(
      "../../../apps/web/src/features/tasks/" + filename,
      import.meta.url
    ),
    "utf8"
  );
  const file = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const fn = file.statements.find((statement) => statement.name?.text === name);
  const code = ts.transpileModule(fn.getText(file).replace(/^export /, ""), {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return runInNewContext(code + "\n" + name, {
    React: {
      Fragment: "Fragment",
      createElement: (type, props, ...children) => ({
        type,
        props: props ?? {},
        children,
      }),
    },
    m: new Proxy({}, { get: (_, key) => () => key }),
    ...scope,
  });
}

function featureNodes(node) {
  if (Array.isArray(node)) return node.flatMap(featureNodes);
  if (!node || typeof node !== "object") return [];
  return [
    node,
    ...featureNodes(node.children),
    ...featureNodes(node.props?.drawerContent),
  ];
}

test("Day, Week and Month share creation drawers and date controls that preserve the current route", () => {
  const webRequire = createRequire(
    new URL("../../../apps/web/package.json", import.meta.url)
  );
  const { addMonths, format } = webRequire("date-fns");
  let selectedDate = "2026-11-17";
  const navigations = [];
  const render = featureRenderer("plan-view.tsx", "PlanView", {
    planningRoute: { useSearch: () => ({ date: selectedDate }) },
    useNavigate: () => (args) => navigations.push(args),
    useSuspenseQuery: () => ({ data: { timezone: "Europe/Prague" } }),
    convexQuery: () => ({}),
    api: { planning: { getSettings: "settings" } },
    localDateTime,
    shiftDate: (date, days) =>
      new Date(Date.parse(date + "T12:00Z") + days * 86400000)
        .toISOString()
        .slice(0, 10),
    addMonths,
    format,
    Button: "Button",
    Drawer: "Drawer",
    DrawerButton: "DrawerButton",
    TaskCreateDrawer: "TaskCreateDrawer",
    ProjectCreateDrawer: "ProjectCreateDrawer",
    EventDetails: "EventDetails",
    PlanningDatePicker: "PlanningDatePicker",
    ErrorSuspense: "ErrorSuspense",
    DayView: "DayView",
    PlanOverview: "PlanOverview",
    ProjectsView: "ProjectsView",
    ChevronLeft: "ChevronLeft",
    ChevronRight: "ChevronRight",
    Plus: "Plus",
  });
  for (const [view, previous, next] of [
    ["day", "2026-11-16", "2026-11-18"],
    ["week", "2026-11-10", "2026-11-24"],
    ["month", "2026-10-17", "2026-12-17"],
  ]) {
    const nodes = featureNodes(render({ view }));
    assert.deepEqual(
      nodes
        .filter((node) => node.type === "DrawerButton")
        .map((node) => node.children.at(-1)),
      ["plan_task", "constraints_event", "projects_project"]
    );
    for (const type of [
      "TaskCreateDrawer",
      "ProjectCreateDrawer",
      "EventDetails",
      "PlanningDatePicker",
    ])
      assert.equal(nodes.filter((node) => node.type === type).length, 1);
    const event = nodes.find((node) => node.type === "EventDetails");
    assert.equal(event.props.day, selectedDate);
    assert.equal(event.props.timezone, "Europe/Prague");
    nodes
      .find((node) => node.props["aria-label"] === "planning_previous")
      .props.onClick();
    assert.equal(navigations.at(-1).search.date, previous);
    nodes
      .find((node) => node.props["aria-label"] === "planning_next")
      .props.onClick();
    assert.equal(navigations.at(-1).search.date, next);
    nodes
      .find((node) => node.type === "PlanningDatePicker")
      .props.onChange("2026-12-01");
    assert.equal(navigations.at(-1).to, "/{-$locale}/dashboard/" + view);
    assert.equal(navigations.at(-1).search.date, "2026-12-01");
  }
  selectedDate = "2027-01-31";
  featureNodes(render({ view: "month" }))
    .find((node) => node.props["aria-label"] === "planning_next")
    .props.onClick();
  assert.equal(navigations.at(-1).search.date, "2027-02-28");
});

test("Compact Project weekday chips follow calendar settings and save the selected cadence", async () => {
  let state = [];
  let index = 0;
  let options;
  let saved;
  const render = featureRenderer("projects.tsx", "ProjectForm", {
    useConvexMutation: () => async (value) => {
      saved = value;
      return "projects-1";
    },
    useSuspenseQuery: () => ({ data: { weekStartsOn: 1 } }),
    convexQuery: () => ({}),
    api: { projects: { saveProject: 0 }, planning: { getSettings: 0 } },
    useState: (initial) => {
      const slot = index++;
      if (!(slot in state)) state[slot] = initial;
      return [
        state[slot],
        (value) => {
          state[slot] = value;
        },
      ];
    },
    useAppForm: (value) => {
      options = value;
      return {
        AppForm: "AppForm",
        FormRoot: "FormRoot",
        AppField: "AppField",
        SubmitButton: "SubmitButton",
        reset: () => {},
      };
    },
    Checkbox: "Checkbox",
    Drawer: { Footer: "DrawerFooter" },
    Button: "Button",
    getLocale: () => "en",
  });
  const project = {
    _id: "projects-1",
    title: "Book",
    weeklyMinutes: 90,
    weekdays: [1, 3],
  };
  let nodes = featureNodes(render({ project }));
  const labels = nodes.filter((node) => node.type === "label");
  assert.deepEqual(
    labels.map((node) => node.children[2].children[0]),
    [
      "constraints_monday",
      "constraints_tuesday",
      "constraints_wednesday",
      "constraints_thursday",
      "constraints_friday",
      "constraints_saturday",
      "constraints_sunday",
    ]
  );
  assert.equal(nodes.filter((node) => node.type === "SubmitButton").length, 1);
  nodes
    .filter((node) => node.type === "Checkbox")[4]
    .props.onCheckedChange(true);
  index = 0;
  nodes = featureNodes(render({ project }));
  assert.equal(
    nodes.filter((node) => node.type === "Checkbox")[4].props.checked,
    true
  );
  await options.onSubmit({
    value: { title: "Book revised", weeklyMinutes: 120 },
  });
  assert.equal(saved.title, "Book revised");
  assert.equal(saved.weeklyMinutes, 120);
  assert.deepEqual(Array.from(saved.weekdays), [1, 3, 5]);
  assert.equal(saved.projectId, project._id);
  index = 0;
  const drawer = featureNodes(render({ drawer: true }));
  assert.equal(drawer.filter((node) => node.type === "DrawerFooter").length, 1);
  assert.equal(drawer.filter((node) => node.type === "SubmitButton").length, 1);
});

test.beforeEach((t) => {
  t.mock.method(Date, "now", () => 100);
});

function database() {
  const rows = new Map();
  const reads = { collected: 0, pages: [] };
  let nextId = 0;
  const db = {
    delete: async (id) => rows.delete(id),
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
        unique: async () => {
          const matches = await query.collect();
          assert.ok(matches.length <= 1);
          return matches[0] ?? null;
        },
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
  const projectId = await db.insert("projects", {
    userId: "alice",
    title: "Reading",
    weeklyMinutes: 60,
    weekdays: [],
  });
  const taskId = await db.insert("tasks", {
    userId: "alice",
    title: "Read",
    projectId,
  });
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
  assert.equal(session.projectId, projectId);
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
  assert.equal(completed.projectId, projectId);
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

test("Projects and Milestones persist per user and reject foreign or mismatched membership", async () => {
  const { db, context } = database();
  const alice = context("alice");
  const projectId = await projects.saveProject._handler(alice, {
    title: "Book",
    weeklyMinutes: 120,
    weekdays: [1, 3],
  });
  const milestoneId = await projects.createMilestone._handler(alice, {
    projectId,
    title: "Chapter one",
  });
  await projects.validateMembership(
    { ...alice, userId: "alice" },
    projectId,
    milestoneId
  );
  const otherId = await projects.saveProject._handler(alice, {
    title: "Other",
    weeklyMinutes: 0,
    weekdays: [],
  });
  await assert.rejects(
    projects.validateMembership(
      { ...alice, userId: "alice" },
      otherId,
      milestoneId
    ),
    /Milestone/
  );
  await assert.rejects(
    projects.validateMembership(
      { ...context("bob"), userId: "bob" },
      projectId
    ),
    /Project not found/
  );
  await assert.rejects(
    projects.createMilestone._handler(context("bob"), {
      projectId,
      title: "Foreign",
    }),
    /Project not found/
  );
  assert.equal(
    (await projects.list._handler(context("bob"), {})).projects.length,
    0
  );
  await projects.saveProject._handler(alice, {
    projectId,
    title: "Book edited",
    weeklyMinutes: 90,
    weekdays: [2],
  });
  assert.equal((await db.get(projectId)).weeklyMinutes, 90);
  assert.equal(
    (await projects.list._handler(alice, {})).milestones[0]._id,
    milestoneId
  );
  for (const invalid of [
    { weeklyMinutes: -1 },
    { weeklyMinutes: 1.5 },
    { weekdays: [7] },
    { weekdays: [1, 1] },
  ])
    await assert.rejects(
      projects.saveProject._handler(alice, {
        title: "Invalid",
        weeklyMinutes: 60,
        weekdays: [],
        ...invalid,
      })
    );
});

test("Task creation and editing preserve Project identity and validate Milestone ownership", async () => {
  const { db, context } = database();
  const alice = context("alice");
  const taskTypeId = await db.insert("taskTypes", {
    userId: "alice",
    name: "Done",
    valueKind: "boolean",
  });
  const priorityClassId = await db.insert("priorityClasses", {
    userId: "alice",
    name: "Normal",
  });
  const projectId = await projects.saveProject._handler(alice, {
    title: "Book",
    weeklyMinutes: 0,
    weekdays: [],
  });
  const milestoneId = await projects.createMilestone._handler(alice, {
    projectId,
    title: "First",
  });
  const base = { title: "Read", taskTypeId, priorityClassId, tags: [] };
  const taskId = await tasks.create._handler(alice, {
    ...base,
    projectId,
    milestoneId,
  });
  assert.equal((await db.get(taskId)).milestoneId, milestoneId);
  await tasks.update._handler(alice, {
    ...base,
    taskId,
    projectId,
    milestoneId,
  });
  assert.equal((await db.get(taskId)).projectId, projectId);
  await assert.rejects(
    tasks.update._handler(alice, { ...base, taskId, milestoneId }),
    /Milestone/
  );
  await tasks.update._handler(alice, { ...base, taskId });
  assert.equal((await db.get(taskId)).projectId, undefined);
  assert.equal((await db.get(taskId)).milestoneId, undefined);
});

test("Project reservations use concrete ready Tasks, spread preferred cadence, and are stable on reload", () => {
  const project = {
    _id: "book",
    title: "Book",
    weeklyMinutes: 120,
    weekdays: [1, 3],
  };
  const rules = {
    ...autoSettings,
    weekly: [1, 3].map((weekday) => ({ weekday, start: 540, end: 600 })),
  };
  const work = [task("read", 120, { projectId: "book" })];
  const first = plan(work, [], { projects: [project], settings: rules });
  assert.equal(first.projectShortfalls.length, 0);
  const placed = first.changes.filter((c) => c.after);
  assert.equal(placed.length, 2);
  assert.ok(
    placed.every((c) => c.taskId === "read" && c.reason.includes("Project"))
  );
  assert.deepEqual(
    placed.map((c) =>
      localDateTime(c.after.startAt, rules.timezone).slice(0, 10)
    ),
    [autoDate, "2030-01-09"]
  );
  const persisted = placed.map((c) => ({
    _id: c.id,
    taskId: c.taskId,
    ...c.after,
    manualOverride: false,
  }));
  assert.equal(
    plan(work, persisted, { projects: [project], settings: rules }).changes
      .length,
    0
  );
});

test("Empty or paused Projects show the next-work shortfall without placeholder Sessions", () => {
  const project = {
    _id: "empty",
    title: "Empty",
    weeklyMinutes: 60,
    weekdays: [],
  };
  const result = plan(
    [
      task("paused", 60, {
        projectId: "empty",
        automaticSchedulingPaused: true,
      }),
      task("unknown", undefined, {
        projectId: "empty",
        effortMinutes: undefined,
      }),
    ],
    [],
    { projects: [project] }
  );
  assert.equal(result.changes.length, 0);
  assert.equal(result.projectShortfalls[0].minutes, 60);
  assert.match(result.projectShortfalls[0].reason, /next Task/);
});

test("Project reservations respect Events, protected time, Pins and Firm deadlines", () => {
  const project = {
    _id: "p",
    title: "Project",
    weeklyMinutes: 120,
    weekdays: [1],
  };
  const pinned = session("pin", "other", "09:00", "09:30", { pinned: true });
  const result = plan(
    [
      task("other", 30),
      task("project", 120, {
        projectId: "p",
        dueAt: autoAt("11:00"),
        finishKind: "firm",
      }),
    ],
    [pinned],
    {
      projects: [project],
      events: [
        {
          title: "Event",
          attention: "focused",
          startAt: autoAt("09:30"),
          endAt: autoAt("10:00"),
        },
      ],
      settings: {
        ...autoSettings,
        protectedDates: [{ date: autoDate, start: 600, end: 630 }],
      },
    }
  );
  assert.ok(result.changes.every((c) => c.id !== "pin"));
  const placed = result.changes.filter(
    (c) => c.after && c.taskId === "project"
  );
  assert.equal(
    placed.reduce((n, c) => n + (c.after.endAt - c.after.startAt) / 60000, 0),
    30
  );
  assert.equal(result.projectShortfalls[0].minutes, 90);
});

test("Completed Project Tasks still credit the weekly target without generating placeholder work", () => {
  const project = {
    _id: "book",
    title: "Book",
    weeklyMinutes: 60,
    weekdays: [1],
  };
  const result = plan(
    [task("done", 60, { projectId: "book", completedAt: autoAt("10:00") })],
    [
      session("history", "done", "09:00", "10:00", {
        checkIn: { reportedAt: autoAt("10:00"), timeMinutes: 60 },
      }),
    ],
    { projects: [project], now: autoAt("10:30") }
  );
  assert.deepEqual(result.projectShortfalls, []);
  assert.deepEqual(result.changes, []);
});

test("Project targets follow configured calendar weeks through DST without duplicating planned credit", () => {
  const project = {
    _id: "book",
    title: "Book",
    weeklyMinutes: 60,
    weekdays: [0],
  };
  const date = "2026-10-25";
  const result = planSessions({
    date,
    settings: { ...settings, weekStartsOn: 0, weekly: [], protectedWeekly: [] },
    tasks: [task("read", 60, { projectId: "book" })],
    sessions: [],
    events: [],
    projects: [project],
    now: at(date + "T00:00"),
  });
  assert.equal(result.projectShortfalls.length, 0);
  assert.equal(
    result.changes.reduce(
      (n, c) => n + (c.after.endAt - c.after.startAt) / 60000,
      0
    ),
    60
  );
  assert.ok(
    result.changes.every((c) =>
      localDateTime(c.after.startAt, settings.timezone).startsWith(date)
    )
  );
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

async function calendarFixture(access = "full") {
  const f = database();
  const grantId = await f.db.insert("calendarGrants", {
    userId: "alice",
    access,
    email: "alice@gmail.com",
    credentials: "encrypted",
    calendars: [
      { id: "personal", title: "Personal", timezone: "Europe/Prague" },
    ],
  });
  const sourceId = await f.db.insert("calendarSources", {
    userId: "alice",
    grantId,
    calendarId: "personal",
    title: "Personal",
    timezone: "Europe/Prague",
    access,
    generation: 1,
  });
  const snapshot = {
    sourceId,
    generation: 1,
    scopeStart: 0,
    scopeEnd: 100_000,
    cancelledIds: [],
    events: [
      {
        sourceEventId: "event-1",
        title: "Original",
        startAt: 1000,
        endAt: 2000,
        timezone: "Europe/Prague",
        location: "Library",
      },
    ],
  };
  return { ...f, grantId, sourceId, snapshot };
}

test("Calendar refresh updates stable Source links, clears removed details, preserves attention corrections and restores cancelled Events", async () => {
  const f = await calendarFixture();
  await calendars.applyRefresh._handler(f.context("alice"), f.snapshot);
  const [event] = await planning.listEvents._handler(f.context("alice"), {});
  assert.equal(event.sourceId, f.sourceId);
  assert.equal(event.attentionUncertain, true);
  await planning.saveEvent._handler(f.context("alice"), {
    eventId: event._id,
    title: event.title,
    startAt: event.startAt,
    endAt: event.endAt,
    timezone: event.timezone,
    attention: "background",
  });
  await assert.rejects(
    planning.saveEvent._handler(f.context("alice"), {
      eventId: event._id,
      title: "Changed source fact",
      startAt: event.startAt,
      endAt: event.endAt,
      timezone: event.timezone,
      attention: "focused",
    })
  );
  await assert.rejects(
    planning.deleteEvent._handler(f.context("alice"), { eventId: event._id })
  );
  await calendars.applyRefresh._handler(f.context("alice"), {
    ...f.snapshot,
    events: [
      {
        ...f.snapshot.events[0],
        title: "Updated",
        location: undefined,
        startAt: 3000,
        endAt: 4000,
      },
    ],
  });
  const [updated] = await planning.listEvents._handler(f.context("alice"), {});
  assert.equal(updated._id, event._id);
  assert.equal(updated.title, "Updated");
  assert.equal(updated.location, undefined);
  assert.equal(updated.attention, "background");
  assert.equal(updated.attentionUncertain, false);
  await calendars.applyRefresh._handler(f.context("alice"), {
    ...f.snapshot,
    events: [],
    cancelledIds: ["event-1"],
  });
  assert.deepEqual(
    await planning.listEvents._handler(f.context("alice"), {}),
    []
  );
  assert.equal((await f.db.get(event._id)).sourceStatus, "cancelled");
  await calendars.applyRefresh._handler(f.context("alice"), f.snapshot);
  const restored = await planning.listEvents._handler(f.context("alice"), {});
  assert.equal(restored.length, 1);
  assert.equal(restored[0]._id, event._id);
  assert.equal(restored[0].attention, "background");
});

test("Failed and superseded refreshes retain previous Events; complete replacement affects only its Import scope", async () => {
  const f = await calendarFixture();
  await calendars.applyRefresh._handler(f.context("alice"), f.snapshot);
  const [event] = await planning.listEvents._handler(f.context("alice"), {});
  await calendars.failRefresh._handler(f.context("alice"), {
    sourceId: f.sourceId,
    generation: 1,
  });
  assert.equal((await f.db.get(f.sourceId)).lastSuccessAt, 100);
  assert.ok((await f.db.get(f.sourceId)).error);
  assert.equal(
    (await planning.listEvents._handler(f.context("alice"), {}))[0]._id,
    event._id
  );
  await calendars.applyRefresh._handler(f.context("alice"), {
    ...f.snapshot,
    generation: 0,
    events: [],
  });
  assert.equal(
    (await planning.listEvents._handler(f.context("alice"), {})).length,
    1
  );
  const outside = await f.db.insert("fixedEvents", {
    ...event,
    _id: undefined,
    startAt: 200_000,
    endAt: 300_000,
    sourceEventId: "outside",
  });
  await calendars.applyRefresh._handler(f.context("alice"), {
    ...f.snapshot,
    events: [],
  });
  assert.equal((await f.db.get(event._id)).sourceStatus, "missing");
  assert.equal((await f.db.get(outside)).deletedAt, undefined);
  assert.equal((await f.db.get(f.sourceId)).error, undefined);
});

test("Disconnect stops queued and in-flight refreshes, deletes credentials, and keeps or removes only the account's derived records", async () => {
  for (const removeRecords of [false, true]) {
    const f = await calendarFixture();
    await calendars.applyRefresh._handler(f.context("alice"), f.snapshot);
    const [event] = await planning.listEvents._handler(f.context("alice"), {});
    const independent = await f.db.insert("fixedEvents", {
      userId: "alice",
      title: "Manual",
      startAt: 5000,
      endAt: 6000,
      timezone: "UTC",
      attention: "focused",
    });
    await assert.rejects(
      calendars.disconnect._handler(f.context("bob"), {
        grantId: f.grantId,
        removeRecords,
      })
    );
    await calendars.disconnect._handler(f.context("alice"), {
      grantId: f.grantId,
      removeRecords,
    });
    assert.equal((await f.db.get(f.grantId)).credentials, undefined);
    assert.equal(
      await calendars.claimRefresh._handler(f.context("alice"), {
        sourceId: f.sourceId,
      }),
      null
    );
    assert.equal(
      await calendars.active._handler(f.context("alice"), {
        sourceId: f.sourceId,
        generation: 1,
      }),
      false
    );
    await calendars.applyRefresh._handler(f.context("alice"), {
      ...f.snapshot,
      events: [{ ...f.snapshot.events[0], title: "Late refresh" }],
    });
    const kept = await f.db.get(event._id);
    if (removeRecords) assert.equal(kept, null);
    else {
      assert.equal(kept.title, "Original");
      assert.equal(kept.sourceId, f.sourceId);
    }
    assert.ok(await f.db.get(independent));
    await calendars.disconnect._handler(f.context("alice"), {
      grantId: f.grantId,
      removeRecords,
    });
  }
});

test("Calendar selection is authenticated, scoped to granted calendars, idempotent and never exposes credentials", async () => {
  const f = await calendarFixture();
  const scheduled = [];
  const ctx = {
    ...f.context("alice"),
    scheduler: { runAfter: async (...args) => scheduled.push(args) },
  };
  const result = await calendars.list._handler(ctx, {});
  assert.equal(result.grants[0].credentials, undefined);
  assert.deepEqual(
    (await calendars.list._handler(f.context("bob"), {})).grants,
    []
  );
  await assert.rejects(calendars.list._handler(f.context(null), {}));
  await assert.rejects(
    calendars.select._handler(ctx, {
      grantId: f.grantId,
      calendarIds: ["unselected"],
    })
  );
  await assert.rejects(
    calendars.select._handler(f.context("bob"), {
      grantId: f.grantId,
      calendarIds: ["personal"],
    })
  );
  await calendars.select._handler(ctx, {
    grantId: f.grantId,
    calendarIds: ["personal", "personal"],
  });
  assert.equal(scheduled.length, 0);
  assert.equal((await calendars.list._handler(ctx, {})).sources.length, 1);
  const claimed = await calendars.claimRefresh._handler(ctx, {
    sourceId: f.sourceId,
  });
  assert.equal(claimed.generation, 2);
  assert.equal(
    await calendars.claimRefresh._handler(ctx, { sourceId: f.sourceId }),
    null
  );
});

test("Google Event mapping preserves date-only DST boundaries, recurrence exceptions, status, timezone, links and identity", () => {
  const allDay = calendarEvent(
    {
      id: "holiday",
      summary: "Holiday",
      status: "tentative",
      start: { date: "2030-03-31" },
      end: { date: "2030-04-01" },
      iCalUID: "uid",
      recurrence: ["RRULE:FREQ=YEARLY"],
      location: "Home",
      htmlLink: "https://calendar.google.com/event",
      conferenceData: {
        entryPoints: [
          { entryPointType: "video", uri: "https://meet.google.com/test" },
        ],
      },
    },
    "Europe/Prague"
  );
  assert.equal(allDay.allDayStart, "2030-03-31");
  assert.equal(allDay.allDayEnd, "2030-04-01");
  assert.equal(allDay.endAt - allDay.startAt, 23 * 3600_000);
  assert.equal(allDay.sourceStatus, "tentative");
  assert.equal(allDay.iCalUID, "uid");
  assert.equal(allDay.meetingLink, "https://meet.google.com/test");
  const instance = calendarEvent(
    {
      id: "instance",
      recurringEventId: "series",
      start: {
        dateTime: "2030-10-27T09:00:00+01:00",
        timeZone: "Europe/Prague",
      },
      end: { dateTime: "2030-10-27T10:00:00+01:00" },
      originalStartTime: { dateTime: "2030-10-27T08:00:00+01:00" },
    },
    "UTC",
    ["RRULE:FREQ=WEEKLY"]
  );
  assert.equal(instance.timezone, "Europe/Prague");
  assert.equal(instance.recurringEventId, "series");
  assert.equal(instance.originalStart, "2030-10-27T08:00:00+01:00");
  assert.deepEqual(instance.recurrence, ["RRULE:FREQ=WEEKLY"]);
  assert.throws(() =>
    calendarEvent({ id: "broken", start: {}, end: {} }, "UTC")
  );
});

test("OAuth and Google refresh use scoped read-only APIs, encrypt credentials and commit only complete paginated snapshots", async (t) => {
  const { default: axios } = await import("axios");
  const { getFunctionName } = await import("convex/server");
  const originalEnv = { ...process.env };
  Object.assign(process.env, {
    GOOGLE_CALENDAR_CLIENT_ID: "test-client",
    GOOGLE_CALENDAR_CLIENT_SECRET: "test-secret",
    CALENDAR_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
    CONVEX_SITE_URL: "https://test.convex.site",
    GOOGLE_CALENDAR_APP_URL: "https://planner.example/settings",
  });
  t.after(() => {
    for (const name of [
      "GOOGLE_CALENDAR_CLIENT_ID",
      "GOOGLE_CALENDAR_CLIENT_SECRET",
      "CALENDAR_ENCRYPTION_KEY",
      "CONVEX_SITE_URL",
      "GOOGLE_CALENDAR_APP_URL",
    ]) {
      if (originalEnv[name] === undefined) delete process.env[name];
      else process.env[name] = originalEnv[name];
    }
  });
  let access = "full";
  let failPage = false;
  let emptySnapshot = false;
  let malformedSnapshot = false;
  let workspaceAccount = false;
  let summary = "Original";
  const requests = [];
  const transport = {
    async post(url, body) {
      requests.push({ method: "POST", url, body });
      if (url.endsWith("/token")) {
        if (body.get("grant_type") === "refresh_token") {
          assert.equal(body.get("refresh_token"), "private-refresh-token");
          return { data: { access_token: "short-lived-token" } };
        }
        const claims = {
          aud: "test-client",
          iss: "https://accounts.google.com",
          exp: 100_000,
          email: "alice@gmail.com",
          email_verified: true,
          ...(workspaceAccount ? { hd: "work.example" } : {}),
        };
        return {
          data: {
            access_token: "short-lived-token",
            refresh_token: "private-refresh-token",
            id_token: `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`,
            scope: `https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.${access === "busy" ? "events.freebusy" : "events.readonly"}`,
          },
        };
      }
      assert.ok(url.endsWith("/freeBusy"));
      assert.deepEqual(body.items, [{ id: "personal" }]);
      return {
        data: {
          calendars: {
            personal: failPage
              ? { errors: [{ reason: "internalError" }] }
              : {
                  busy: [
                    {
                      start: "1970-01-01T10:00:00Z",
                      end: "1970-01-01T11:00:00Z",
                    },
                  ],
                },
          },
        },
      };
    },
    async get(url, options) {
      requests.push({ method: "GET", url, params: options.params });
      if (url.endsWith("/calendarList"))
        return {
          data: {
            items: [
              {
                id: "personal",
                summary: "Personal",
                timeZone: "Europe/Prague",
                accessRole: "owner",
              },
            ],
          },
        };
      assert.ok(url.endsWith("/calendars/personal/events"));
      assert.equal(access, "full");
      if (malformedSnapshot) return { data: {} };
      if (emptySnapshot) return { data: { kind: "calendar#events" } };
      if (!options.params.singleEvents)
        return {
          data: {
            items: [{ id: "series", recurrence: ["RRULE:FREQ=WEEKLY"] }],
          },
        };
      if (options.params.pageToken) {
        if (failPage) throw new Error("Second page unavailable");
        return { data: { items: [{ id: "second", status: "cancelled" }] } };
      }
      return {
        data: {
          items: [
            {
              id: "one",
              summary,
              recurringEventId: "series",
              start: { dateTime: "1970-01-01T10:00:00Z" },
              end: { dateTime: "1970-01-01T11:00:00Z" },
            },
          ],
          nextPageToken: "page-two",
        },
      };
    },
  };
  t.mock.method(axios, "create", () => transport);
  const google = await import("../convex/googleCalendar.ts");
  for (access of ["full", "busy"]) {
    requests.length = 0;
    failPage = false;
    summary = "Original";
    const f = database();
    const ctx = {
      ...f.context("alice"),
      runMutation: (ref, args) =>
        calendars[getFunctionName(ref).split(":")[1]]._handler(
          f.context("alice"),
          args
        ),
      runQuery: (ref, args) =>
        calendars[getFunctionName(ref).split(":")[1]]._handler(
          f.context("alice"),
          args
        ),
    };
    const url = new URL(await google.connect._handler(ctx, { access }));
    assert.equal(url.searchParams.get("include_granted_scopes"), "false");
    assert.equal(
      url.searchParams.get("redirect_uri"),
      "https://test.convex.site/calendar/google/callback"
    );
    assert.equal(
      url.searchParams.get("scope").includes("calendar.events.readonly"),
      access === "full"
    );
    const state = url.searchParams.get("state");
    const beforeUnauthorized = requests.length;
    await assert.rejects(
      google.completeAuthorization._handler(
        { ...ctx, auth: { getUserIdentity: async () => ({ subject: "bob" }) } },
        { state, code: "code" }
      )
    );
    assert.equal(requests.length, beforeUnauthorized);
    await assert.rejects(
      google.completeAuthorization._handler(ctx, {
        state: "unrecognized",
        code: "code",
      })
    );
    await google.completeAuthorization._handler(ctx, { state, code: "code" });
    await assert.rejects(
      google.completeAuthorization._handler(ctx, { state, code: "code" })
    );
    const grant = [...f.rows.values()].find((row) =>
      row._id.startsWith("calendarGrants-")
    );
    assert.ok(grant.credentials);
    assert.ok(!grant.credentials.includes("private-refresh-token"));
    await calendars.select._handler(
      { ...f.context("alice"), scheduler: { runAfter: async () => {} } },
      { grantId: grant._id, calendarIds: ["personal"] }
    );
    const source = [...f.rows.values()].find((row) =>
      row._id.startsWith("calendarSources-")
    );
    await google.refresh._handler(ctx, { sourceId: source._id });
    const [first] = await planning.listEvents._handler(f.context("alice"), {});
    assert.ok(first);
    if (access === "busy") {
      assert.equal(first.title, "Busy");
      for (const key of [
        "location",
        "meetingLink",
        "recurrence",
        "sourceUrl",
        "iCalUID",
        "sourceStatus",
      ])
        assert.equal(first[key], undefined);
      assert.ok(!requests.some((request) => request.url.endsWith("/events")));
    } else {
      assert.deepEqual(first.recurrence, ["RRULE:FREQ=WEEKLY"]);
      assert.ok(
        requests.some((request) => request.params?.pageToken === "page-two")
      );
    }
    failPage = true;
    summary = "Updated";
    await google.refresh._handler(ctx, { sourceId: source._id });
    assert.ok((await f.db.get(source._id)).error);
    assert.equal(
      (await f.db.get(first._id)).title,
      access === "busy" ? "Busy" : "Original"
    );
    failPage = false;
    await google.refresh._handler(ctx, { sourceId: source._id });
    const refreshed = await planning.listEvents._handler(
      f.context("alice"),
      {}
    );
    assert.equal(refreshed.length, 1);
    assert.equal(refreshed[0]._id, first._id);
    assert.equal(refreshed[0].title, access === "busy" ? "Busy" : "Updated");
    if (access === "full") {
      malformedSnapshot = true;
      await google.refresh._handler(ctx, { sourceId: source._id });
      assert.ok((await f.db.get(source._id)).error);
      assert.equal(
        (await planning.listEvents._handler(f.context("alice"), {})).length,
        1
      );
      malformedSnapshot = false;
      emptySnapshot = true;
      await google.refresh._handler(ctx, { sourceId: source._id });
      assert.deepEqual(
        await planning.listEvents._handler(f.context("alice"), {}),
        []
      );
      assert.equal((await f.db.get(source._id)).error, undefined);
      emptySnapshot = false;
      await google.refresh._handler(ctx, { sourceId: source._id });
      assert.equal(
        (await planning.listEvents._handler(f.context("alice"), {}))[0]._id,
        first._id
      );
    }
    assert.ok(
      requests.every(
        (request) =>
          request.method === "GET" ||
          request.url.endsWith("/token") ||
          request.url.endsWith("/freeBusy")
      )
    );
    await calendars.disconnect._handler(f.context("alice"), {
      grantId: grant._id,
      removeRecords: false,
    });
    const count = requests.length;
    await google.refresh._handler(ctx, { sourceId: source._id });
    assert.equal(requests.length, count);
    workspaceAccount = true;
    const workUrl = new URL(await google.connect._handler(ctx, { access }));
    await assert.rejects(
      google.completeAuthorization._handler(ctx, {
        state: workUrl.searchParams.get("state"),
        code: "code",
      }),
      /personal Google accounts/
    );
    workspaceAccount = false;
  }
});

test("Disconnecting one calendar preserves other Sources and their Events", async () => {
  const f = await calendarFixture();
  await calendars.applyRefresh._handler(f.context("alice"), f.snapshot);
  const otherId = await f.db.insert("calendarSources", {
    ...(await f.db.get(f.sourceId)),
    calendarId: "other",
  });
  const otherEvent = await f.db.insert("fixedEvents", {
    userId: "alice",
    title: "Other calendar",
    startAt: 1000,
    endAt: 2000,
    timezone: "UTC",
    attention: "focused",
    sourceId: otherId,
  });
  await assert.rejects(
    calendars.disconnectSource._handler(f.context("bob"), {
      sourceId: f.sourceId,
      removeRecords: true,
    })
  );
  await calendars.disconnectSource._handler(f.context("alice"), {
    sourceId: f.sourceId,
    removeRecords: true,
  });
  assert.equal((await f.db.get(otherId)).disconnectedAt, undefined);
  assert.ok(await f.db.get(otherEvent));
  assert.ok((await f.db.get(f.grantId)).credentials);
  assert.equal(
    await calendars.claimRefresh._handler(f.context("alice"), {
      sourceId: f.sourceId,
    }),
    null
  );
  assert.deepEqual(
    (await planning.listEvents._handler(f.context("alice"), {})).map(
      (event) => event._id
    ),
    [otherEvent]
  );
});

test("The Day warning distinguishes stale and failed Sources while disconnect confirmation defaults to keeping Events", () => {
  let sources = [];
  const render = featureRenderer("../calendar-sources.tsx", "CalendarSources", {
    Date,
    useSuspenseQuery: () => ({ data: { grants: [], sources } }),
    convexQuery: () => ({}),
    api: {
      calendars: { list: "list", refresh: "refresh" },
      googleCalendar: { connect: "connect" },
    },
    useState: (initial) => [
      typeof initial === "function" ? initial() : initial,
      () => {},
    ],
    useEffect: () => {},
    useAction: () => {},
    useMutation: () => ({}),
    useConvexMutation: () => {},
    Link: "Link",
  });
  assert.equal(render({ compact: true }), null);
  sources = [
    {
      _id: "source",
      title: "Personal",
      lastSuccessAt: Date.now() - 7 * 60_000,
    },
  ];
  let nodes = featureNodes(render({ compact: true }));
  assert.ok(nodes.some((node) => node.props.role === "status"));
  sources[0].lastSuccessAt = Date.now();
  assert.equal(render({ compact: true }), null);
  sources[0].error = "failed";
  nodes = featureNodes(render({ compact: true }));
  assert.ok(nodes.some((node) => node.type === "Link"));
  sources[0].disconnectedAt = Date.now();
  assert.equal(render({ compact: true }), null);
  const state = [true, false];
  const changes = [];
  const disconnect = featureRenderer(
    "../calendar-sources.tsx",
    "CalendarSourceDisconnect",
    {
      useState: () => [state.shift(), (value) => changes.push(value)],
      api: { calendars: { disconnectSource: "disconnect" } },
      useConvexMutation: () => {},
      useMutation: () => ({ mutate: (args) => changes.push(args) }),
      Button: "Button",
      Select: "Select",
    }
  );
  const confirmation = featureNodes(disconnect({ source: { _id: "source" } }));
  assert.equal(
    confirmation.find((node) => node.type === "Select").props.value,
    "keep"
  );
  confirmation
    .find(
      (node) =>
        node.type === "Button" &&
        node.children.includes("calendar_confirm_disconnect")
    )
    .props.onClick();
  assert.equal(changes.at(-1).sourceId, "source");
  assert.equal(changes.at(-1).removeRecords, false);
});

test("All-day dates stay on their calendar dates across planning timezones without changing stored source data", async () => {
  const f = await calendarFixture();
  const event = calendarEvent(
    {
      id: "all-day",
      summary: "Holiday",
      start: { date: "2030-03-31" },
      end: { date: "2030-04-01" },
    },
    "Europe/Prague"
  );
  await calendars.applyRefresh._handler(f.context("alice"), {
    ...f.snapshot,
    events: [event],
  });
  const timezone = "America/Los_Angeles";
  const [display] = await planning.listEvents._handler(f.context("alice"), {
    timezone,
  });
  const bounds = dayBounds("2030-03-31", timezone);
  assert.equal(display.allDayStart, "2030-03-31");
  assert.equal(display.startAt, bounds.startAt);
  assert.equal(display.endAt, bounds.endAt);
  assert.equal((await f.db.get(display._id)).startAt, event.startAt);
  assert.equal(
    projectAllDayEvent(display, "Europe/Prague").startAt,
    event.startAt
  );
  const settings = {
    timezone,
    weekly: [],
    overrides: [],
    protectedWeekly: [],
    protectedDates: [],
  };
  assert.deepEqual(
    placementConflicts(
      { startAt: bounds.startAt - 3600_000, endAt: bounds.startAt },
      settings,
      [event]
    ),
    []
  );
  assert.ok(
    placementConflicts(
      { startAt: bounds.endAt - 3600_000, endAt: bounds.endAt },
      settings,
      [{ ...event, attention: "focused" }]
    ).length
  );
  const result = planSessions({
    date: "2030-03-31",
    now: bounds.startAt,
    settings,
    events: [{ ...event, attention: "focused" }],
    tasks: [{ _id: "task", title: "Read", effortMinutes: 30 }],
    sessions: [],
  });
  assert.ok(result.changes.length);
  assert.ok(result.changes[0].after.startAt >= bounds.endAt);
  await planning.setEventAttention._handler(f.context("alice"), {
    eventId: display._id,
    attention: "background",
  });
  assert.equal((await f.db.get(display._id)).attentionUncertain, false);
  await assert.rejects(
    planning.setEventAttention._handler(f.context("bob"), {
      eventId: display._id,
      attention: "focused",
    })
  );
});

test("Disconnection cancels an already-consumed OAuth callback before it can attach credentials", async () => {
  const f = await calendarFixture();
  await calendars.authorize._handler(f.context("alice"), {
    state: "pending-state",
    userId: "alice",
    access: "full",
  });
  const auth = await calendars.consumeAuthorization._handler(
    f.context("alice"),
    { state: "pending-state", userId: "alice" }
  );
  await calendars.disconnect._handler(f.context("alice"), {
    grantId: f.grantId,
    removeRecords: false,
  });
  await assert.rejects(
    calendars.finishAuthorization._handler(f.context("alice"), {
      authorizationId: auth._id,
      userId: "alice",
      access: "full",
      email: "second@gmail.com",
      credentials: "encrypted",
      calendars: [],
    })
  );
  assert.deepEqual(
    (await calendars.list._handler(f.context("alice"), {})).grants,
    []
  );
});

test("Reconnecting a retained calendar reuses its Source and Event identities without duplicates", async () => {
  const f = await calendarFixture();
  await calendars.applyRefresh._handler(f.context("alice"), f.snapshot);
  const [original] = await planning.listEvents._handler(f.context("alice"), {});
  await planning.setEventAttention._handler(f.context("alice"), {
    eventId: original._id,
    attention: "background",
  });
  await calendars.disconnect._handler(f.context("alice"), {
    grantId: f.grantId,
    removeRecords: false,
  });
  const grantId = await f.db.insert("calendarGrants", {
    userId: "alice",
    access: "full",
    email: "alice@gmail.com",
    credentials: "new-encrypted-token",
    calendars: [
      { id: "personal", title: "Personal", timezone: "Europe/Prague" },
    ],
  });
  await calendars.select._handler(
    { ...f.context("alice"), scheduler: { runAfter: async () => {} } },
    { grantId, calendarIds: ["personal"] }
  );
  const { sources } = await calendars.list._handler(f.context("alice"), {});
  assert.equal(sources.length, 1);
  assert.equal(sources[0]._id, f.sourceId);
  assert.equal(sources[0].grantId, grantId);
  const claim = await calendars.claimRefresh._handler(f.context("alice"), {
    sourceId: f.sourceId,
  });
  await calendars.applyRefresh._handler(f.context("alice"), {
    ...f.snapshot,
    generation: claim.generation,
    events: [{ ...f.snapshot.events[0], title: "After reconnect" }],
  });
  const records = await planning.listEvents._handler(f.context("alice"), {});
  assert.equal(records.length, 1);
  assert.equal(records[0]._id, original._id);
  assert.equal(records[0].title, "After reconnect");
  assert.equal(records[0].attention, "background");
});

const travelInstant = (time) => Date.parse("2026-11-17T" + time + ":00Z");
const travelEvent = (values = {}) => ({
  title: "Visit",
  startAt: travelInstant("10:00"),
  endAt: travelInstant("11:00"),
  timezone: "UTC",
  attention: "focused",
  attendance: "physical",
  locationRequirement: "Clinic",
  journey: {
    origin: "Home",
    mode: "drive",
    routeMinutes: 30,
    marginPercent: 20,
    arrivalMinutes: 10,
    wrapUpMinutes: 5,
  },
  ...values,
});

test("Journeys separate route, margin, arrival and wrap-up; online and remote hybrid Events need no travel", () => {
  const event = travelEvent();
  const {
    journeys: [j],
    blocks,
  } = planTravel([event]);
  assert.equal(j.startAt, travelInstant("09:14"));
  assert.equal(j.endAt, travelInstant("09:50"));
  assert.equal(j.marginMinutes, 6);
  assert.equal(blocks.length, 3);
  assert.equal(blocks[1].endAt, event.startAt);
  assert.equal(blocks[2].endAt, travelInstant("11:05"));
  assert.deepEqual(
    planTravel([travelEvent({ attendance: "online" })]).blocks,
    []
  );
  assert.deepEqual(
    planTravel([
      travelEvent({ attendance: "hybrid", hybridAttendance: "online" }),
    ]).journeys,
    []
  );
  assert.equal(
    planTravel([travelEvent({ attendance: "hybrid" })]).journeys[0]
      .routeMinutes,
    undefined
  );
});

test("Unknown route time and whereabouts remain unresolved, while infeasible travel preserves fixed Events", () => {
  const event = travelEvent();
  const previous = travelEvent({
    title: "Earlier",
    startAt: travelInstant("08:00"),
    endAt: travelInstant("09:45"),
    locationRequirement: "Home",
  });
  const original = structuredClone([previous, event]);
  const result = planTravel([previous, event]);
  assert.equal(result.journeys[1].shortfallMinutes, 36);
  assert.deepEqual([previous, event], original);
  const unknown = travelEvent({
    journey: { ...event.journey, routeMinutes: undefined },
  });
  const unresolved = planTravel([unknown]);
  assert.match(unresolved.journeys[0].uncertainty, /manual route/);
  assert.equal(unresolved.journeys[0].routeMinutes, undefined);
  assert.ok(
    placementConflicts(
      { startAt: travelInstant("09:00"), endAt: travelInstant("09:30") },
      null,
      [unknown]
    ).some((r) => r.includes("Journey"))
  );
  assert.match(
    planTravel([travelEvent({ journey: { ...event.journey, origin: "" } })])
      .journeys[0].uncertainty,
    /origin/
  );
});

test("Compatible errands share an existing Journey only at its location and without moving unrelated Sessions", () => {
  const event = travelEvent();
  const errand = {
    _id: "errand",
    title: "Collect medicine",
    attendance: "physical",
    locationRequirement: "Clinic",
    effortMinutes: 15,
  };
  const unrelated = {
    _id: "unrelated",
    taskId: "read",
    startAt: travelInstant("12:00"),
    endAt: travelInstant("12:30"),
    pinned: true,
  };
  const settings = {
    timezone: "UTC",
    weekly: [],
    overrides: [],
    protectedWeekly: [],
    protectedDates: [],
  };
  const result = planSessions({
    date: "2026-11-17",
    now: travelInstant("08:00"),
    settings,
    events: [event],
    tasks: [errand, { _id: "read", title: "Read", effortMinutes: 30 }],
    sessions: [unrelated],
  });
  const placement = result.changes.find((c) => c.taskId === "errand").after;
  assert.equal(placement.startAt, travelInstant("11:05"));
  assert.equal(
    result.changes.some((c) => c.id === unrelated._id),
    false
  );
  assert.deepEqual(locationConflicts(placement, errand, [event]), []);
  assert.equal(
    locationConflicts(
      placement,
      { ...errand, locationRequirement: "Elsewhere" },
      [event]
    ).length,
    1
  );
  assert.equal(
    locationConflicts(
      { startAt: travelInstant("08:00"), endAt: travelInstant("08:15") },
      errand,
      [event]
    ).length,
    1
  );
});

test("Travel is enforced for manual and automatic Sessions, Event edits, and ownership", async () => {
  const { db, context } = database();
  const taskId = await db.insert("tasks", { userId: "alice", title: "Read" });
  const eventId = await planning.saveEvent._handler(
    context("alice"),
    travelEvent()
  );
  for (const automatic of [false, true]) {
    await assert.rejects(
      saveSession._handler(context("alice"), {
        taskId,
        startAt: travelInstant("09:20"),
        endAt: travelInstant("09:40"),
        automatic,
      }),
      /Journey/
    );
  }
  await saveSession._handler(context("alice"), {
    taskId,
    startAt: travelInstant("09:20"),
    endAt: travelInstant("09:40"),
    allowConflict: true,
  });
  await assert.rejects(
    planning.saveEvent._handler(context("bob"), { ...travelEvent(), eventId })
  );
  await assert.rejects(
    planning.saveEvent._handler(
      context("alice"),
      travelEvent({ journey: { ...travelEvent().journey, routeMinutes: -1 } })
    )
  );
  await planning.saveEvent._handler(context("alice"), {
    ...travelEvent({ attendance: "online" }),
    eventId,
  });
  assert.equal((await db.get(eventId)).startAt, travelInstant("10:00"));
  assert.deepEqual(
    placementConflicts(
      { startAt: travelInstant("09:20"), endAt: travelInstant("09:40") },
      null,
      [await db.get(eventId)]
    ),
    []
  );
});

test("Task attendance and Location requirements persist through create and edit", async () => {
  const { db, context } = database();
  const taskTypeId = await db.insert("taskTypes", {
    userId: "alice",
    valueKind: "boolean",
  });
  const priorityClassId = await db.insert("priorityClasses", {
    userId: "alice",
  });
  const input = {
    title: "Collect medicine",
    taskTypeId,
    priorityClassId,
    tags: [],
    attendance: "physical",
    locationRequirement: "Clinic",
  };
  const taskId = await tasks.create._handler(context("alice"), input);
  assert.equal((await db.get(taskId)).attendance, "physical");
  assert.equal((await db.get(taskId)).locationRequirement, "Clinic");
  await tasks.update._handler(context("alice"), {
    ...input,
    taskId,
    attendance: "hybrid",
    hybridAttendance: "online",
    locationRequirement: "",
  });
  const updated = await db.get(taskId);
  assert.equal(updated.attendance, "hybrid");
  assert.equal(updated.hybridAttendance, "online");
  assert.equal(updated.locationRequirement, "");
});

test("Travel spans midnight and DST using elapsed duration without shifting the fixed Event", () => {
  for (const startAt of [
    zonedInstant("2026-03-29T03:15", "Europe/Prague"),
    zonedInstant("2026-10-25T02:15", "Europe/Prague", "later"),
    zonedInstant("2026-11-18T00:15", "Europe/Prague"),
  ]) {
    const event = travelEvent({
      startAt,
      endAt: startAt + 3600000,
      timezone: "Europe/Prague",
    });
    const [journey] = planTravel([event]).journeys;
    assert.equal(journey.startAt, startAt - 46 * 60000);
    assert.equal(journey.endAt, startAt - 10 * 60000);
    assert.equal(event.startAt, startAt);
  }
});

test("Sharing a Journey never displaces an existing Session just to batch an errand", () => {
  const settings = {
    timezone: "UTC",
    weekly: [],
    overrides: [],
    protectedWeekly: [],
    protectedDates: [],
  };
  const event = travelEvent();
  const next = travelEvent({
    title: "Leave",
    startAt: travelInstant("12:00"),
    endAt: travelInstant("13:00"),
    locationRequirement: "Office",
    journey: { ...event.journey, origin: "Clinic" },
  });
  const session = {
    _id: "keep",
    taskId: "read",
    startAt: travelInstant("11:05"),
    endAt: travelInstant("11:14"),
    manualOverride: false,
  };
  const result = planSessions({
    date: "2026-11-17",
    now: travelInstant("08:00"),
    settings,
    events: [event, next],
    tasks: [
      { _id: "read", title: "Read", effortMinutes: 9, minSessionMinutes: 9 },
      {
        _id: "errand",
        title: "Collect",
        attendance: "physical",
        locationRequirement: "Clinic",
        effortMinutes: 9,
        minSessionMinutes: 9,
        priority: "high",
      },
    ],
    sessions: [session],
  });
  assert.equal(
    result.changes.some((c) => c.id === session._id),
    false
  );
  assert.equal(
    result.changes.some((c) => c.taskId === "errand"),
    false
  );
  assert.equal(result.shortfalls.find((s) => s.taskId === "errand").minutes, 9);
});

test("Leisure displacement records only net duration lost to pressing work; moves and manual skips create no request", () => {
  const leisure = task("reading", 60, {
    leisure: true,
    priority: "low",
    recoveryWindowDays: 3,
  });
  const work = task("work", 180, {
    priority: "critical",
    dueAt: autoAt("12:00"),
  });
  const previous = session("read", "reading", "09:00", "10:00");
  const lost = plan([leisure, work], [previous]);
  assert.equal(lost.recoveries.length, 1);
  assert.equal(lost.recoveries[0].minutes, 60);
  assert.equal(lost.recoveries[0].expiresOn, "2030-01-10");
  assert.equal(lost.recoveries[0].taskId, "reading");
  const shortened = plan(
    [leisure, { ...work, effortMinutes: 150 }],
    [previous]
  );
  assert.equal(shortened.recoveries[0].minutes, 30);
  const moved = plan([leisure, { ...work, effortMinutes: 60 }], [previous]);
  assert.equal(moved.recoveries.length, 0);
  assert.equal(
    plan([leisure], [{ ...previous, unscheduledAt: autoAt("08:00") }])
      .recoveries.length,
    0
  );
  assert.equal(
    plan([leisure], [previous], { replanAll: true }).recoveries.length,
    0
  );
});

test("Leisure and reserve recovery share the daily cap, preserve activity identity, and expire without ordinary effort debt", () => {
  const request = {
    _id: "leisure",
    taskId: "reading",
    kind: "leisure",
    title: "Read",
    date: "2030-01-06",
    expiresOn: "2030-01-09",
    minutes: 90,
    allocations: [],
  };
  const reserve = {
    ...request,
    _id: "reserve",
    taskId: undefined,
    kind: "reserve",
    title: "Free-time reserve",
    minutes: 60,
  };
  const rules = {
    ...autoSettings,
    weekly: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      start: 540,
      end: 720,
    })),
    dailyRecoveryMinutes: 30,
  };
  const result = plan(
    [task("reading", 90, { leisure: true, maxSessionMinutes: 20 })],
    [],
    { settings: rules, recoveryRequests: [request, reserve] }
  );
  assert.ok(result.recoveryPlacements.length > 0);
  assert.ok(
    result.recoveryPlacements.every(
      (p) =>
        p.taskId === "reading" &&
        p.requestId === "leisure" &&
        (p.endAt - p.startAt) / 60000 <= 20
    )
  );
  assert.ok(result.changes.length === 0);
  const byDay = new Map();
  for (const allocation of result.recoveries.flatMap((r) => r.allocations)) {
    const date = localDateTime(allocation.startAt, rules.timezone).slice(0, 10);
    byDay.set(
      date,
      (byDay.get(date) ?? 0) + (allocation.endAt - allocation.startAt) / 60000
    );
    assert.ok(date <= request.expiresOn);
  }
  assert.ok([...byDay.values()].every((minutes) => minutes <= 30));
  assert.ok(
    result.recoveries.find((r) => r.kind === "reserve").allocations.length > 0
  );
  const expired = plan([task("reading", 90, { leisure: true })], [], {
    recoveryRequests: [{ ...request, expiresOn: "2030-01-06" }],
  });
  assert.deepEqual(expired.changes, []);
  assert.deepEqual(expired.recoveryPlacements, []);
  assert.equal(expired.recoveries[0].minutes, 90);
});

test("Reserve borrowing preserves the protected minimum, records only automatic borrowing, and restores unallocated time", () => {
  const rules = {
    ...autoSettings,
    reservePreferredMinutes: 60,
    reserveMinimumMinutes: 30,
  };
  const ordinary = plan([task("ordinary", 180)], [], { settings: rules });
  assert.equal(
    ordinary.changes.reduce(
      (n, c) => n + (c.after.endAt - c.after.startAt) / 60000,
      0
    ),
    120
  );
  assert.equal(ordinary.recoveries.length, 0);
  const work = task("work", 180, { priority: "critical" });
  const urgent = plan([work], [], { settings: rules });
  assert.equal(
    urgent.changes.reduce(
      (n, c) => n + (c.after.endAt - c.after.startAt) / 60000,
      0
    ),
    150
  );
  assert.equal(urgent.recoveries.length, 1);
  assert.equal(urgent.recoveries[0].kind, "reserve");
  assert.equal(urgent.recoveries[0].minutes, 30);
  const sessions = urgent.changes.map((c) => ({
    _id: c.id,
    taskId: c.taskId,
    ...c.after,
    manualOverride: false,
  }));
  const reload = plan([work], sessions, {
    settings: rules,
    recoveryRequests: urgent.recoveries,
  });
  assert.equal(reload.recoveries.length, 1);
  const manual = plan(
    [work],
    [session("manual", "work", "09:00", "12:00", { manualOverride: true })],
    { settings: rules }
  );
  assert.equal(manual.recoveries.length, 0);
  const restored = plan([], [], {
    settings: rules,
    date: "2030-01-14",
    now: at("2030-01-14T08:00"),
    recoveryRequests: urgent.recoveries,
  });
  assert.equal(restored.recoveryPlacements.length, 0);
  assert.equal(
    restored.recoveries[0].allocations.reduce(
      (n, a) => n + (a.endAt - a.startAt) / 60000,
      0
    ),
    30
  );
});

test("Recovery respects boundaries and exposes repeated displacement without extending old requests", () => {
  const requests = ["2030-01-04", "2030-01-05", "2030-01-06"].map(
    (date, i) => ({
      _id: String(i),
      taskId: "read",
      kind: "leisure",
      title: "Read",
      date,
      expiresOn: "2030-01-07",
      minutes: 60,
      allocations: [],
    })
  );
  const result = plan([task("read", 180, { leisure: true })], [], {
    recoveryRequests: requests,
    settings: {
      ...autoSettings,
      protectedDates: [{ date: autoDate, start: 540, end: 720 }],
    },
  });
  assert.equal(result.recoveryImbalance, true);
  assert.deepEqual(result.recoveryPlacements, []);
  assert.ok(result.recoveries.every((r) => r.expiresOn === "2030-01-07"));
  assert.throws(
    () =>
      validatePlanning({
        ...autoSettings,
        reservePreferredMinutes: 10,
        reserveMinimumMinutes: 20,
      }),
    /minimum/
  );
  assert.throws(() =>
    validatePlanning({ ...autoSettings, dailyRecoveryMinutes: -1 })
  );
  assert.throws(() =>
    validatePlanning({ ...autoSettings, recoveryWindowDays: 0 })
  );
});

test("Recovery requests and same-activity Sessions persist without duplicates; ownership, extension, dismissal and undo are enforced", async () => {
  const { db, context } = database();
  const alice = context("alice");
  await db.insert("planningSettings", { userId: "alice", ...autoSettings });
  const readId = await db.insert("tasks", {
    userId: "alice",
    title: "Read",
    leisure: true,
    effortMinutes: 60,
    priority: "low",
  });
  const readSessionId = await db.insert("sessions", {
    userId: "alice",
    taskId: readId,
    startAt: autoAt("09:00"),
    endAt: autoAt("10:00"),
    manualOverride: false,
  });
  await db.insert("tasks", {
    userId: "alice",
    title: "Urgent",
    priority: "critical",
    effortMinutes: 180,
    dueAt: autoAt("12:00"),
  });
  const selection = { date: autoDate, timezone: autoSettings.timezone };
  await planning.planDay._handler(alice, selection);
  let requests = await planning.listRecovery._handler(alice, {});
  assert.equal(requests.length, 1);
  assert.equal(requests[0].minutes, 60);
  assert.equal(requests[0].taskId, readId);
  await planning.planDay._handler(alice, selection);
  assert.equal((await planning.listRecovery._handler(alice, {})).length, 1);
  await planning.undoPlan._handler(alice, {});
  assert.equal((await planning.listRecovery._handler(alice, {})).length, 0);
  assert.equal((await db.get(readSessionId)).unscheduledAt, undefined);
  assert.deepEqual(
    await planning.listRecovery._handler(context("bob"), {}),
    []
  );

  const requestId = await db.insert("recoveryRequests", {
    userId: "alice",
    kind: "leisure",
    taskId: readId,
    title: "Read",
    date: "2030-01-06",
    expiresOn: "2030-01-10",
    minutes: 60,
    allocations: [],
  });
  await db.patch(readSessionId, { unscheduledAt: Date.now() });
  await db.patch(readId, { automaticSchedulingPaused: false });
  await planning.planDay._handler(alice, selection);
  const recoverySessions = await db.query("sessions").collect();
  const restored = recoverySessions.filter(
    (s) => s.recoveryRequestId === requestId && s.unscheduledAt === undefined
  );
  assert.equal(restored.length, 1);
  assert.equal(restored[0].taskId, readId);
  assert.equal((restored[0].endAt - restored[0].startAt) / 60000, 60);
  await planning.planDay._handler(alice, selection);
  assert.equal(
    (await db.query("sessions").collect()).filter(
      (s) => s.recoveryRequestId === requestId && s.unscheduledAt === undefined
    ).length,
    1
  );
  await assert.rejects(
    planning.updateRecovery._handler(context("bob"), {
      requestId,
      action: "dismiss",
    })
  );
  await saveSession._handler(alice, {
    sessionId: restored[0]._id,
    taskId: readId,
    startAt: autoAt("10:00"),
    endAt: autoAt("11:00"),
  });
  assert.deepEqual((await db.get(requestId)).allocations, [
    { startAt: autoAt("10:00"), endAt: autoAt("11:00") },
  ]);
  await assert.rejects(
    planning.undoPlan._handler(alice, {}),
    /Recovery has changed/
  );
  await planning.updateRecovery._handler(alice, {
    requestId,
    action: "extend",
  });
  assert.equal((await db.get(requestId)).expiresOn, "2030-01-17");
  await planning.updateRecovery._handler(alice, {
    requestId,
    action: "dismiss",
  });
  assert.ok((await db.get(requestId)).dismissedAt);
  assert.ok((await db.get(restored[0]._id)).unscheduledAt);
});

test("A new fixed Event replans a recovery opportunity within its original window instead of creating fresh debt", () => {
  const allocation = { startAt: autoAt("09:00"), endAt: autoAt("10:00") };
  const request = {
    _id: "recover",
    taskId: "read",
    kind: "leisure",
    title: "Read",
    date: "2030-01-06",
    expiresOn: "2030-01-07",
    minutes: 60,
    allocations: [allocation],
  };
  const result = plan(
    [task("read", 60, { leisure: true })],
    [
      {
        _id: "recovery-session",
        taskId: "read",
        recoveryRequestId: "recover",
        ...allocation,
      },
    ],
    {
      recoveryRequests: [request],
      events: [{ title: "Meeting", attention: "focused", ...allocation }],
    }
  );
  assert.equal(result.recoveries.length, 1);
  assert.equal(result.recoveries[0].expiresOn, request.expiresOn);
  assert.equal(result.recoveryPlacements.length, 1);
  assert.equal(result.recoveryPlacements[0].startAt, autoAt("10:00"));
  assert.ok(
    result.changes.some(
      (c) => c.id === "recovery-session" && c.after === undefined
    )
  );
  assert.deepEqual(request.allocations, [allocation]);
});

test("Recovery opportunities outlive an expired leisure Occurrence and remain editable without generating recurrence debt", async (t) => {
  const f = await recurringFixture(t);
  const first = f.occurrences()[0];
  await f.db.patch(first._id, { leisure: true });
  await f.db.insert("recoveryRequests", {
    userId: "alice",
    kind: "leisure",
    taskId: first._id,
    title: "Exercise",
    date: "2030-01-07",
    expiresOn: "2030-01-10",
    minutes: 30,
    allocations: [],
  });
  f.now("2030-01-08T08:00");
  await planning.planDay._handler(f.context("alice"), {
    date: "2030-01-08",
    timezone: f.rule.timezone,
  });
  assert.ok((await f.db.get(first._id)).expiredAt);
  const recovery = (await f.db.query("sessions").collect()).find(
    (s) => s.recoveryRequestId
  );
  assert.ok(recovery);
  assert.equal(recovery.taskId, first._id);
  await saveSession._handler(f.context("alice"), {
    sessionId: recovery._id,
    taskId: first._id,
    startAt: at("2030-01-08T15:00"),
    endAt: at("2030-01-08T15:30"),
  });
  await f.sync();
  assert.equal((await f.db.get(recovery._id)).unscheduledAt, undefined);
});

test("Changing the protected reserve minimum adjusts flexible automatic Sessions and surfaces immovable shortfalls", () => {
  const rules = {
    ...autoSettings,
    reservePreferredMinutes: 60,
    reserveMinimumMinutes: 30,
  };
  const work = task("work", 180, { priority: "critical" });
  const automatic = plan(
    [work],
    [session("work-session", "work", "09:00", "12:00")],
    { settings: rules }
  );
  const placements = automatic.changes.filter((c) => c.after);
  assert.equal(
    placements.reduce(
      (n, c) => n + (c.after.endAt - c.after.startAt) / 60000,
      0
    ),
    150
  );
  assert.equal(automatic.recoveries.length, 0);
  const pinned = plan(
    [work],
    [session("pinned", "work", "09:00", "12:00", { pinned: true })],
    { settings: rules }
  );
  assert.equal(pinned.changes.length, 0);
  assert.ok(pinned.conflicts.some((c) => c.includes("reserve minimum")));
});

test("Recovery Sessions retain a physical Task's Location requirement after planner integration", () => {
  const result = planSessions({
    date: "2026-11-17",
    now: travelInstant("08:00"),
    settings: {
      timezone: "UTC",
      weekly: [],
      overrides: [],
      protectedWeekly: [],
      protectedDates: [],
    },
    tasks: [
      {
        _id: "sport",
        title: "Sport",
        attendance: "physical",
        locationRequirement: "Gym",
        effortMinutes: 15,
        leisure: true,
      },
    ],
    sessions: [],
    events: [],
    recoveryRequests: [
      {
        _id: "recover",
        kind: "leisure",
        taskId: "sport",
        title: "Sport",
        date: "2026-11-16",
        expiresOn: "2026-11-23",
        minutes: 15,
        allocations: [],
      },
    ],
  });
  assert.deepEqual(result.recoveryPlacements, []);
});
