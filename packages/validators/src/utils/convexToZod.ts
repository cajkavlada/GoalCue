/* eslint-disable @typescript-eslint/no-explicit-any */
import { Zid, zid } from "convex-helpers/server/zod";
import {
  GenericId,
  GenericValidator,
  PropertyValidators,
  Validator,
  VArray,
  VBoolean,
  VFloat64,
  VId,
  VInt64,
  VLiteral,
  VNull,
  VObject,
  VRecord,
  VString,
  VUnion,
} from "convex/values";
import { z } from "zod";

type ZodFromValidatorBase<V extends GenericValidator> =
  V extends VId<GenericId<infer TableName extends string>>
    ? Zid<TableName>
    : V extends VString<infer T, any>
      ? T extends string & { _: infer Brand extends string }
        ? z.ZodBranded<z.ZodString, Brand>
        : z.ZodString
      : V extends VFloat64<any, any>
        ? z.ZodNumber
        : V extends VInt64<any, any>
          ? z.ZodBigInt
          : V extends VBoolean<any, any>
            ? z.ZodBoolean
            : V extends VNull<any, any>
              ? z.ZodNull
              : V extends VLiteral<infer T, any>
                ? z.ZodLiteral<T>
                : V extends VObject<any, infer Fields, any, any>
                  ? z.ZodObject<
                      {
                        [K in keyof Fields]: ZodValidatorFromConvex<Fields[K]>;
                      },
                      "strip"
                    >
                  : V extends VRecord<any, infer Key, infer Value, any, any>
                    ? Key extends VId<GenericId<infer TableName>>
                      ? z.ZodRecord<
                          Zid<TableName>,
                          ZodValidatorFromConvex<Value>
                        >
                      : z.ZodRecord<z.ZodString, ZodValidatorFromConvex<Value>>
                    : V extends VArray<any, any>
                      ? z.ZodArray<ZodValidatorFromConvex<V["element"]>>
                      : V extends VUnion<
                            any,
                            [
                              infer A extends GenericValidator,
                              infer B extends GenericValidator,
                              ...infer Rest extends GenericValidator[],
                            ],
                            any,
                            any
                          >
                        ? z.ZodUnion<
                            [
                              ZodValidatorFromConvex<A>,
                              ZodValidatorFromConvex<B>,
                              ...{
                                [K in keyof Rest]: ZodValidatorFromConvex<
                                  Rest[K]
                                >;
                              },
                            ]
                          >
                        : z.ZodTypeAny; // fallback for unknown validators

type ZodLiteralsTuple<Members extends readonly VLiteral<any, any>[]> =
  Members extends [infer A, infer B, ...infer Rest]
    ? [
        A extends VLiteral<infer L, any> ? z.ZodLiteral<L> : never,
        B extends VLiteral<infer L, any> ? z.ZodLiteral<L> : never,
        ...{
          [K in keyof Rest]: Rest[K] extends VLiteral<infer L, any>
            ? z.ZodLiteral<L>
            : never;
        },
      ]
    : never; // not enough members

export type ZodValidatorFromConvex<V extends GenericValidator> =
  // 1) OPTIONAL id → z.optional( zid<T> )
  V extends VId<
    GenericId<infer TableName extends string> | undefined,
    "optional"
  >
    ? z.ZodOptional<Zid<TableName>>
    : V extends VUnion<
          any,
          [VLiteral<any, any>, VLiteral<any, any>, ...VLiteral<any, any>[]],
          "optional",
          any
        >
      ? z.ZodOptional<z.ZodUnion<ZodLiteralsTuple<V["members"]>>>
      : V extends VUnion<any, VLiteral<infer L, any>[], "optional", any>
        ? z.ZodOptional<
            z.ZodEnum<[Extract<L, string>, ...Extract<L, string>[]]>
          >
        : V extends VUnion<
              any,
              [VLiteral<any, any>, VLiteral<any, any>, ...VLiteral<any, any>[]],
              any,
              any
            >
          ? z.ZodUnion<ZodLiteralsTuple<V["members"]>>
          : V extends VUnion<any, VLiteral<infer L, any>[], any, any>
            ? z.ZodEnum<[Extract<L, string>, ...Extract<L, string>[]]>
            : V extends Validator<any, "optional", any>
              ? z.ZodOptional<ZodFromValidatorBase<V>>
              : ZodFromValidatorBase<V>;

// export function convexToZod<T extends string>(
//   v: Validator<VId<T>, "optional", any>
// ): z.ZodOptional<z.ZodString>;

// // Generic fallback
// export function convexToZod<V extends GenericValidator>(
//   v: V
// ): ZodValidatorFromConvex<V>;

/**
 * Turn a Convex validator into a Zod validator.
 * @param convexValidator Convex validator can be any validator from "convex/values" e.g. `v.string()`
 * @returns Zod validator (e.g. `z.string()`) with inferred type matching the Convex validator
 */
export function convexToZod<V extends GenericValidator>(
  convexValidator: V
): ZodValidatorFromConvex<V> {
  const isOptional = (convexValidator as any).isOptional === "optional";

  let zodValidator: z.ZodTypeAny;

  switch (convexValidator.kind) {
    case "id":
      zodValidator = zid((convexValidator as VId<any>).tableName);
      break;
    case "string":
      zodValidator = z.string();
      break;
    case "float64":
      zodValidator = z.number();
      break;
    case "int64":
      zodValidator = z.bigint();
      break;
    case "boolean":
      zodValidator = z.boolean();
      break;
    case "null":
      zodValidator = z.null();
      break;
    case "any":
      zodValidator = z.any();
      break;
    case "array": {
      const arrayValidator = convexValidator as VArray<any, any>;
      zodValidator = z.array(convexToZod(arrayValidator.element));
      break;
    }
    case "object": {
      const objectValidator = convexValidator as VObject<any, any>;
      zodValidator = z.object(convexToZodFields(objectValidator.fields));
      break;
    }
    case "union": {
      const unionValidator = convexValidator as VUnion<any, any, any, any>;
      const memberValidators = unionValidator.members.map(
        (member: GenericValidator) => convexToZod(member)
      );
      zodValidator = z.union([
        memberValidators[0],
        memberValidators[1],
        ...memberValidators.slice(2),
      ]);
      break;
    }
    case "literal": {
      const literalValidator = convexValidator as VLiteral<any>;
      zodValidator = z.literal(literalValidator.value);
      break;
    }
    case "record": {
      const recordValidator = convexValidator as VRecord<
        any,
        any,
        any,
        any,
        any
      >;
      zodValidator = z.record(
        convexToZod(recordValidator.key),
        convexToZod(recordValidator.value)
      );
      break;
    }
    default:
      throw new Error(`Unknown convex validator type: ${convexValidator.kind}`);
  }

  return isOptional
    ? (z.optional(zodValidator) as ZodValidatorFromConvex<V>)
    : (zodValidator as ZodValidatorFromConvex<V>);
}

/**
 * Like convexToZod, but it takes in a bare object, as expected by Convex
 * function arguments, or the argument to defineTable.
 *
 * @param convexValidators Object with string keys and Convex validators as values
 * @returns Object with the same keys, but with Zod validators as values
 */
export function convexToZodFields<C extends PropertyValidators>(
  convexValidators: C
) {
  return Object.fromEntries(
    Object.entries(convexValidators).map(([k, v]) => [k, convexToZod(v)])
  ) as { [k in keyof C]: ZodValidatorFromConvex<C[k]> };
}
