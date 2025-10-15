import { UseMutationResult } from "@tanstack/react-query";

export type SubmitStatus = UseMutationResult<
  unknown,
  unknown,
  unknown,
  unknown
>["status"];
