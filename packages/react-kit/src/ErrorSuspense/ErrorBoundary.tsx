import {
  FallbackProps,
  ErrorBoundary as ReactErrorBoundary,
} from "react-error-boundary";

import { DefaultErrorFallback } from "./DefaultErrorFallback";

export function ErrorBoundary({
  children,
  errorFallback = DefaultErrorFallback,
}: {
  children: React.ReactNode;
  errorFallback?: (props: FallbackProps) => React.ReactNode;
}) {
  return (
    <ReactErrorBoundary FallbackComponent={errorFallback}>
      {children}
    </ReactErrorBoundary>
  );
}
