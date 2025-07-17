import type { FormHTMLAttributes } from "react";

import { useFormContext } from "../useAppForm";

export function FormRoot({
  children,
  ...props
}: FormHTMLAttributes<HTMLFormElement>) {
  const form = useFormContext();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      {...props}
    >
      {children}
    </form>
  );
}
