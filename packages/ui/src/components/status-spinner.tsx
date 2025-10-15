import { CircleCheckBig, CircleX } from "lucide-react";

import type { SubmitStatus } from "@gc/react-kit";

import { Spinner } from "./spinner";

export function StatusSpinner({ status = "idle" }: { status: SubmitStatus }) {
  return (
    <>
      {status === "pending" && <Spinner />}
      {status === "success" && <CircleCheckBig />}
      {status === "error" && <CircleX />}
    </>
  );
}
