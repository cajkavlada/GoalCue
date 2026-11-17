import { validate } from "convex-helpers/validators";
import { ObjectType, PropertyValidators, v } from "convex/values";

import { AuthedMutationCtx } from "./authedFunctions";
import { rateLimit } from "./rateLimiter";

export function planningTool<A extends PropertyValidators, R>(definition: {
  args: A;
  rateLimit?: { name: string; config?: { rate: number; capacity: number } };
  handler: (ctx: AuthedMutationCtx, args: ObjectType<A>) => Promise<R>;
}) {
  return {
    ...definition,
    schema: JSON.stringify(v.object(definition.args), (_key, value) =>
      value && typeof value === "object" && value.kind
        ? {
            type: value.kind,
            optional: value.isOptional === "optional" || undefined,
            fields: value.fields,
            element: value.element,
            members: value.members,
            value: value.value,
            table: value.tableName,
          }
        : value
    ),
    invoke: async (ctx: AuthedMutationCtx, input: unknown) => {
      const validator = v.object(definition.args);
      validate(validator, input, { throw: true, db: ctx.db });
      if (definition.rateLimit)
        await rateLimit({
          ctx,
          name: definition.rateLimit.name,
          config: definition.rateLimit.config,
        });
      return definition.handler(ctx, input as ObjectType<A>);
    },
  };
}
