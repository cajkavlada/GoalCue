import { csCZ, enUS } from "@clerk/localizations";
import { LocalizationResource } from "@clerk/types";

export const clerkLocalizations: Record<string, LocalizationResource> = {
  cs: csCZ,
  en: enUS,
};

export type Locale = keyof typeof clerkLocalizations;
