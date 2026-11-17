import { useState } from "react";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";

import { api } from "@gc/convex/api";
import { Doc, Id } from "@gc/convex/types";
import { useAppForm } from "@gc/form";
import { m } from "@gc/i18n/messages";
import { Button, Input, Select } from "@gc/ui";
import { jiraFields, JiraMapping, parseJiraCsv } from "@gc/validators";

export function JiraImport() {
  const { data: sources } = useSuspenseQuery(convexQuery(api.jira.list, {}));
  const { data: types } = useSuspenseQuery(
    convexQuery(api.taskTypes.listExtended, {})
  );
  const { data: classes } = useSuspenseQuery(
    convexQuery(api.priorityClasses.list, {})
  );
  const save = useConvexMutation(api.jira.importCsv);
  const [csv, setCsv] = useState("");
  const [selectedSource, setSelectedSource] = useState("none");
  const [parsed, setParsed] = useState<ReturnType<typeof parseJiraCsv>>();
  const [mapping, setMapping] = useState<JiraMapping>({});
  const [statuses, setStatuses] = useState<Doc<"jiraSources">["statusMapping"]>(
    {}
  );
  const [priorities, setPriorities] = useState<
    Doc<"jiraSources">["priorityMapping"]
  >({});
  const [error, setError] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof save>>>();
  const form = useAppForm({
    defaultValues: {
      instance: "",
      job: "",
      fallbackMinutes: 45,
      taskTypeId: types[0]?._id ?? "",
      priorityClassId: classes[0]?._id ?? "",
    },
    onSubmit: async ({ value }) => {
      setError("");
      setResult(undefined);
      try {
        setResult(
          await save({
            ...value,
            taskTypeId: value.taskTypeId as Id<"taskTypes">,
            priorityClassId: value.priorityClassId as Id<"priorityClasses">,
            csv,
            mapping,
            statusMapping: statuses,
            priorityMapping: priorities,
          })
        );
        setCsv("");
        setParsed(undefined);
      } catch (error) {
        setError((error as Error).message);
      }
    },
  });
  const values = (field: "status" | "priority") => [
    ...new Set(
      parsed?.rows
        .map((row) => row[parsed.headers.indexOf(mapping[field] ?? "")]?.trim())
        .filter((value): value is string => !!value)
    ),
  ];
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <p className="text-muted-foreground text-sm">{m.jira_help()}</p>
      <label className="block space-y-1">
        <span>{m.jira_saved()}</span>
        <Select<string>
          value={selectedSource}
          options={[
            { value: "none", label: m.jira_new() },
            ...sources.map((source) => ({
              value: source._id,
              label: `${source.job} · ${source.instance}`,
            })),
          ]}
          onValueChange={(id) => {
            setSelectedSource(id);
            const source = sources.find((s) => s._id === id);
            if (!source) {
              form.reset();
              setMapping({});
              setStatuses({});
              setPriorities({});
              return;
            }
            form.setFieldValue("instance", source.instance);
            form.setFieldValue("job", source.job);
            form.setFieldValue("fallbackMinutes", source.fallbackMinutes);
            setMapping(source.mapping);
            setStatuses(source.statusMapping);
            setPriorities(source.priorityMapping);
          }}
        />
      </label>
      <form.AppField name="instance">
        {(field) => <field.Input label={m.jira_instance()} />}
      </form.AppField>
      <form.AppField name="job">
        {(field) => <field.Input label={m.jira_job()} />}
      </form.AppField>
      <form.AppField name="fallbackMinutes">
        {(field) => (
          <field.Input
            type="number"
            label={m.jira_fallback()}
          />
        )}
      </form.AppField>
      <form.AppField name="taskTypeId">
        {(field) => (
          <field.Select<string>
            label={m.jira_task_type()}
            options={types.map((type) => ({
              value: type._id,
              label: type.name,
            }))}
          />
        )}
      </form.AppField>
      <form.AppField name="priorityClassId">
        {(field) => (
          <field.Select<string>
            label={m.jira_priority_class()}
            options={classes.map((item) => ({
              value: item._id,
              label: item.name,
            }))}
          />
        )}
      </form.AppField>
      <label className="block space-y-1">
        <span>{m.jira_file()}</span>
        <Input
          type="file"
          accept=".csv,text/csv"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            setError("");
            setResult(undefined);
            setCsv("");
            setParsed(undefined);
            if (!file) return;
            try {
              if (file.size > 500000) throw new Error(m.jira_file_limit());
              const text = await file.text();
              const data = parseJiraCsv(text);
              setCsv(text);
              setParsed(data);
            } catch (error) {
              setError((error as Error).message);
            }
          }}
        />
      </label>
      {parsed && (
        <>
          <p className="text-sm">{m.jira_format()}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {jiraFields.map((field) => (
              <label
                key={field}
                className="space-y-1"
              >
                <span>{m[`jira_field_${field}`]()}</span>
                <Select
                  value={mapping[field] || "none"}
                  options={[
                    { value: "none", label: m.jira_unmapped() },
                    ...parsed.headers.map((header) => ({
                      value: header,
                      label: header,
                    })),
                  ]}
                  onValueChange={(column) =>
                    setMapping((current) => ({
                      ...current,
                      [field]: column === "none" ? "" : column,
                    }))
                  }
                />
              </label>
            ))}
          </div>
          {values("status").map((status) => (
            <label
              key={status}
              className="block space-y-1"
            >
              <span>
                {m.jira_status()}: {status}
              </span>
              <Select
                value={statuses[status] ?? "ready"}
                options={[
                  { value: "ready", label: m.jira_ready() },
                  { value: "paused", label: m.jira_paused() },
                  { value: "done", label: m.jira_done() },
                ]}
                onValueChange={(value) =>
                  setStatuses((current) => ({
                    ...current,
                    [status]: value as "ready" | "paused" | "done",
                  }))
                }
              />
            </label>
          ))}
          {values("priority").map((priority) => (
            <label
              key={priority}
              className="block space-y-1"
            >
              <span>
                {m.jira_priority()}: {priority}
              </span>
              <Select
                value={priorities[priority] ?? "normal"}
                options={["low", "normal", "high", "critical"].map((value) => ({
                  value,
                  label:
                    m[
                      `planning_${value as "low" | "normal" | "high" | "critical"}`
                    ](),
                }))}
                onValueChange={(value) =>
                  setPriorities((current) => ({
                    ...current,
                    [priority]: value as "low" | "normal" | "high" | "critical",
                  }))
                }
              />
            </label>
          ))}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {result && (
        <div role="status">
          <p>
            {m.jira_result({
              imported: result.imported,
              changed: result.changed,
              unchanged: result.unchanged,
              rejected: result.rejected.length,
            })}
          </p>
          {result.rejected.map((item) => (
            <p key={item.row}>
              {m.jira_rejected({ row: item.row, reason: item.reason })}
            </p>
          ))}
        </div>
      )}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(busy) => (
          <Button
            type="submit"
            disabled={
              busy ||
              !csv ||
              !mapping.identity ||
              !mapping.summary ||
              !types.length ||
              !classes.length
            }
          >
            {m.jira_import()}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
