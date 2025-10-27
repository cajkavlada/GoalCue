import { m } from "@gc/i18n/messages";

type TranslatableItem = {
  name: string;
  i18nKey?: string;
};

export function translatePregeneratedItem<T extends TranslatableItem>(
  item: T
): T {
  return {
    ...item,
    name: (item.i18nKey
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((m as Record<string, any>)[item.i18nKey]?.() ?? item.name)
      : item.name) as string,
  };
}
