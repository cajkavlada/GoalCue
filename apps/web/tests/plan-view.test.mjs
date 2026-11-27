import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { URL } from "node:url";
import { runInNewContext } from "node:vm";

const require = createRequire(new URL("../package.json", import.meta.url));
const ts = require("typescript");

function load(source, mocks) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    { exports, require: (name) => mocks[name] ?? require(name), Intl, Date }
  );
  return exports;
}

const validators = load(
  readFileSync(
    new URL("../../../packages/validators/src/planning.ts", import.meta.url),
    "utf8"
  ),
  { "./travel": {} }
);
const source = readFileSync(
  new URL("../src/features/tasks/plan-view.tsx", import.meta.url),
  "utf8"
);

function render(view, date, weekStartsOn = 1, locale = "en-US") {
  const navigations = [];
  const effects = [];
  const jsx = (type, props) => ({ type, props });
  const components = new Proxy({}, { get: (_, name) => name });
  const exports = load(`${source}\nexport { PlanningPeriodPicker };`, {
    react: {
      useEffect: (effect) => effects.push(effect),
      useState: (value) => [value, () => {}],
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "@convex-dev/react-query": { convexQuery: () => ({}) },
    "@tanstack/react-query": {
      useSuspenseQuery: () => ({
        data: { timezone: "Europe/Prague", weekStartsOn },
      }),
    },
    "@tanstack/react-router": {
      getRouteApi: () => ({ useSearch: () => ({ date }) }),
      useNavigate: () => (navigation) => navigations.push(navigation),
    },
    "@gc/convex/api": { api: { planning: { getSettings: "settings" } } },
    "@gc/i18n/messages": { m: new Proxy({}, { get: (_, name) => () => name }) },
    "@gc/i18n/runtime": { getLocale: () => locale },
    "@gc/react-kit": components,
    "@gc/ui": components,
    "@gc/validators": validators,
    "./day-calendar-layout": {},
    "./day-view": components,
    "./projects": components,
    "./schedule-constraints": components,
    "./task-create-drawer": components,
  });
  const tree = exports.PlanView({ view });
  effects.forEach((effect) => effect());
  return { tree, navigations, picker: exports.PlanningPeriodPicker };
}

function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}

test("day picker allows future years and extends its range while navigating", () => {
  const states = [];
  let stateIndex;
  const jsx = (type, props) => ({ type, props });
  const components = new Proxy({}, { get: (_, name) => name });
  const { DatePicker } = load(
    readFileSync(
      new URL(
        "../../../packages/ui/src/components/date/date-picker.tsx",
        import.meta.url
      ),
      "utf8"
    ),
    {
      react: {
        useEffect: () => {},
        useId: () => "date",
        useRef: (current) => ({ current }),
        useState: (initial) => {
          const index = stateIndex++;
          if (!(index in states)) states[index] = initial;
          return [
            states[index],
            (value) => {
              states[index] = value;
            },
          ];
        },
      },
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "@gc/i18n/messages": {
        m: new Proxy({}, { get: (_, name) => () => name }),
      },
      "@gc/i18n/runtime": { getLocale: () => "en" },
      "../button": components,
      "../input": components,
      "../popover": components,
      "./calendar": components,
      "./date-locale": { dateFnsLocales: { en: {} } },
      "./date-parser": {},
    }
  );
  const calendar = () => {
    stateIndex = 0;
    return nodes(
      DatePicker({
        value: new Date(2026, 11, 1),
        onChange: () => {},
        onBlur: () => {},
        onInvalidDateError: () => {},
      })
    ).find((node) => node.type === "Calendar").props;
  };
  const initial = calendar();
  assert.ok(initial.endMonth > new Date(2027, 0, 1));
  initial.onMonthChange(initial.endMonth);
  assert.ok(calendar().endMonth > initial.endMonth);
});

test("month URLs use year-month and navigation crosses year boundaries", () => {
  const { tree, navigations } = render("month", "2026-12-31");
  assert.equal(navigations[0].search.date, "2026-12");
  const next = nodes(tree).find(
    (node) => node.props?.["aria-label"] === "planning_next"
  );
  next.props.onClick();
  assert.equal(navigations.at(-1).search.date, "2027-01");
  assert.equal(render("month", "2026-11").navigations.length, 0);
});

test("route validation accepts month URLs and rejects invalid dates", () => {
  const { Route } = load(
    readFileSync(
      new URL(
        "../src/routes/{-$locale}/_protected/dashboard.tsx",
        import.meta.url
      ),
      "utf8"
    ),
    {
      "@tanstack/react-router": { createFileRoute: () => (config) => config },
      "@gc/i18n/messages": {},
      "@gc/react-kit": {},
      "@/features/planning-chat": {},
    }
  );
  for (const date of ["2026-11", "2026-11-27"]) {
    assert.equal(Route.validateSearch({ date }).date, date);
  }
  for (const date of ["2026-13", "2026-00", "2026-02-30", "invalid"]) {
    assert.equal(Route.validateSearch({ date }).date, undefined);
  }
});

test("week URLs and navigation follow the configured first weekday", () => {
  for (const [weekday, expected] of [
    [1, "2026-11-23"],
    [0, "2026-11-22"],
    [6, "2026-11-21"],
  ]) {
    const { tree, navigations } = render("week", "2026-11-27", weekday);
    assert.equal(navigations[0].search.date, expected);
    nodes(tree)
      .find((node) => node.props?.["aria-label"] === "planning_next")
      .props.onClick();
    assert.equal(
      navigations.at(-1).search.date,
      validators.shiftDate(expected, 7)
    );
  }
});

test("day view retains the date picker and exact selected day", () => {
  const { tree, navigations } = render("day", "2026-11-27");
  assert.equal(navigations.length, 0);
  assert.equal(
    nodes(tree).find((node) => node.type === "PlanningDatePicker").props.value,
    "2026-11-27"
  );
});

test("period pickers offer months or whole weeks and label both years", () => {
  for (const locale of ["en-US", "cs"]) {
    const { picker } = render("week", "2026-12-28", 1, locale);
    const selected = [];
    const tree = picker({
      view: "week",
      day: "2026-12-28",
      weekStartsOn: 1,
      onChange: (date) => selected.push(date),
    });
    const trigger = nodes(tree).find(
      (node) => node.props?.["aria-label"] === "plan_selected_date"
    );
    assert.match(trigger.props.children[0], /2026/);
    assert.match(trigger.props.children[0], /2027/);
    const weeks = nodes(tree).filter((node) => node.props?.onClick);
    assert.equal(weeks.length, 5);
    weeks.at(-1).props.onClick();
    assert.equal(selected[0], "2026-12-28");
    const month = picker({
      view: "month",
      day: "2026-11-01",
      weekStartsOn: 1,
      onChange: () => {},
    });
    assert.equal(nodes(month).filter((node) => node.props?.onClick).length, 1);
    assert.equal(
      nodes(month).some((node) => node.type === "Calendar"),
      false
    );
  }
});
