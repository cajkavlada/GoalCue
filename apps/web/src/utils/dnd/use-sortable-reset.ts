import { useState } from "react";

export function useSortableReset() {
  const [resetKey, setResetKey] = useState(0);

  function triggerReset() {
    setResetKey((prev) => prev + 1);
  }

  return { resetKey, triggerReset };
}
