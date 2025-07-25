import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { api } from "@gc/convex/api";
import { useAppForm } from "@gc/form";

export const Route = createFileRoute("/_protected/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { data: tasks } = useSuspenseQuery(convexQuery(api.tasks.getTasks, {}));
  const addTask = useMutation({
    mutationFn: useConvexMutation(api.tasks.addTask),
  });

  const form = useAppForm({
    defaultValues: {
      title: "",
    },
    onSubmit: ({ value }) => {
      addTask.mutate(value);
    },
  });
  return (
    <div className="border-2 border-gray-300 p-4">
      <form.AppForm>
        <form.FormRoot>
          <form.AppField name="title">
            {(field) => <field.Input label="Title" />}
          </form.AppField>
          <form.SubmitButton showSubmitResponse>Add task</form.SubmitButton>
        </form.FormRoot>
      </form.AppForm>
      <div>
        {tasks.map((task) => (
          <p
            key={task._id}
            className="text-foreground"
          >
            {task.title}
          </p>
        ))}
      </div>
    </div>
  );
}
