import { Suspense } from "react";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";

import { DefaultErrorFallback } from "./default-error-fallback";
import { DefaultLoadingFallback } from "./default-loading-fallback";

export function ErrorSuspense({
  children,
  errorFallback = DefaultErrorFallback,
  fallback = <DefaultLoadingFallback />,
}: {
  children: React.ReactNode;
  errorFallback?: (props: FallbackProps) => React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <ErrorBoundary FallbackComponent={errorFallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  );
}
