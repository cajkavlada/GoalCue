import { useContext } from "react";

import { DialogContext } from "./dialog-provider";

export const useDialog = () => useContext(DialogContext);
