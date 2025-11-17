export function getTextColorForBg(color: string | undefined) {
  if (!color) return "inherit";

  const match = color.match(/oklch\(([\d.]+)\s/);
  if (!match || typeof match[1] !== "string") return "inherit";

  const L = parseFloat(match[1] as string);

  return L < 0.58 ? "white" : "black";
}
