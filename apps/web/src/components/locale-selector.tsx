import { Globe } from "lucide-react";

import { m } from "@gc/i18n/messages";
import { getLocale, locales, setLocale } from "@gc/i18n/runtime";
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Tooltip,
} from "@gc/ui";

export function LocaleSelector() {
  const currentLocale = getLocale();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
        >
          <Globe className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">{m.locale_select_label()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((locale) => (
          <Tooltip
            key={locale}
            content={m.locale_select_item({ locale })}
          >
            <DropdownMenuCheckboxItem
              key={locale}
              checked={locale === currentLocale}
              onClick={() => setLocale(locale)}
            >
              {locale}
            </DropdownMenuCheckboxItem>
          </Tooltip>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
