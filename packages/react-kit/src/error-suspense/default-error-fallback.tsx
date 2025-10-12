import type { FallbackProps } from "react-error-boundary";

export function DefaultErrorFallback({ error }: FallbackProps) {
  return (
    <div className="flex flex-col gap-4 p-10 text-red-500">
      <h2 className="text-2xl font-bold">Something went wrong</h2>
      <p>{error.message}</p>
    </div>
  );
}
