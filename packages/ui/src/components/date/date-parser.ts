import {
  parse as parseNatural,
  parseDate as parseNaturalDate,
} from "chrono-node";
import { endOfDay, isValid, parse } from "date-fns";

import { getLocale } from "@gc/i18n/runtime";

import { dateFnsLocales, dateLocales } from "./date-locale";

const CZ_FORMATS = [
  "d. MMMM yyyy",
  "d. M. yyyy",
  "d.M.yyyy",
  "yyyy-M-d",
  "d.M.",
  "d. MMMM",
];

export function parseStringToDate(input: string, defaultTime?: "end-of-day") {
  const trimmedInput = input.trim();
  const locale = getLocale();
  if (locale === "en") {
    const result = parseNaturalDate(trimmedInput);
    const [parsedResult] = parseNatural(trimmedInput);
    if (
      result &&
      defaultTime === "end-of-day" &&
      !parsedResult?.start?.isCertain("hour")
    ) {
      return endOfDay(result);
    }
    return result;
  } else if (locale === "cs") {
    for (const format of CZ_FORMATS) {
      const date = parse(trimmedInput, format, new Date(), {
        locale: dateFnsLocales[locale],
      });
      if (isValid(date)) {
        if (defaultTime === "end-of-day") {
          return endOfDay(date);
        }
        return date;
      }
    }
  }
  return null;
}

export function parseDateToString(date: Date | undefined, full?: "full") {
  if (!date) return "";
  const locale = getLocale();
  return date.toLocaleDateString(dateLocales[locale], {
    day: full ? "numeric" : undefined,
    month: full ? "long" : "short",
    year: full ? "numeric" : undefined,
  });
}
