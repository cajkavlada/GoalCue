export function asFormValidator<T>(schema: unknown): T {
  return schema as T;
}
