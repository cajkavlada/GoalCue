export const jiraFields = [
  "identity",
  "link",
  "summary",
  "description",
  "status",
  "priority",
  "assignee",
  "dueDate",
  "remainingMinutes",
  "estimateMinutes",
  "storyPoints",
  "project",
  "parent",
  "boards",
  "sprint",
  "sprintEnd",
  "sprintFirm",
] as const;

export type JiraMapping = Partial<Record<(typeof jiraFields)[number], string>>;

export function parseJiraCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closedQuote = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (quoted) {
        quoted = false;
        closedQuote = true;
      } else if (!field && !closedQuote) quoted = true;
      else throw new Error("Invalid CSV quoting");
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
      closedQuote = false;
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
      closedQuote = false;
    } else {
      if (closedQuote && !quoted)
        throw new Error("Unexpected text after CSV quote");
      field += c;
    }
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  row.push(field);
  if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift() ?? [];
  if (
    !headers.length ||
    new Set(headers).size !== headers.length ||
    headers.some((h) => !h.trim())
  )
    throw new Error("CSV needs unique, nonempty column headers");
  if (rows.some((r) => r.length !== headers.length))
    throw new Error("CSV row has the wrong number of columns");
  return { headers, rows };
}

export function mapJiraRow(
  headers: string[],
  row: string[],
  mapping: JiraMapping,
  fallbackMinutes: number
) {
  const value = (field: (typeof jiraFields)[number]) => {
    const column = mapping[field];
    if (column && !headers.includes(column))
      throw new Error(`Missing column: ${column}`);
    return column ? (row[headers.indexOf(column)] ?? "").trim() : "";
  };
  const number = (field: (typeof jiraFields)[number]) => {
    const text = value(field);
    if (!text) return undefined;
    const n = Number(text);
    if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid ${field}`);
    return n;
  };
  const date = (field: "dueDate" | "sprintEnd") => {
    const text = value(field);
    if (!text) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text))
      throw new Error(`Use YYYY-MM-DD for ${field}`);
    const n = Date.parse(`${text}T23:59:59.999Z`);
    if (!Number.isFinite(n) || new Date(n).toISOString().slice(0, 10) !== text)
      throw new Error(`Invalid ${field}`);
    return n;
  };
  const identity = value("identity"),
    title = value("summary");
  if (!identity || !title)
    throw new Error("Issue identity and summary are required");
  const remaining = number("remainingMinutes"),
    estimate = number("estimateMinutes");
  const due = date("dueDate"),
    sprintEnd = date("sprintEnd");
  const firm = value("sprintFirm").toLowerCase();
  if (firm && !["true", "false", "yes", "no", "1", "0"].includes(firm))
    throw new Error("Invalid sprint firm flag");
  return {
    identity,
    title,
    description: value("description"),
    link: value("link"),
    status: value("status"),
    priority: value("priority"),
    assignee: value("assignee"),
    project: value("project"),
    parent: value("parent"),
    boards: [
      ...new Set(
        value("boards")
          .split(";")
          .map((b) => b.trim())
          .filter(Boolean)
      ),
    ],
    sprint: value("sprint"),
    sprintEnd,
    storyPoints: number("storyPoints"),
    effortMinutes:
      remaining ?? (estimate === undefined ? fallbackMinutes : estimate * 0.5),
    estimateBasis:
      remaining !== undefined
        ? "remaining"
        : estimate !== undefined
          ? "half-original"
          : "fallback",
    dueAt: due ?? sprintEnd,
    finishKind:
      due !== undefined || ["true", "yes", "1"].includes(firm)
        ? ("firm" as const)
        : ("preferred" as const),
  };
}
