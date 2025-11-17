// 20 predefined colors in oklch format
// Organized in 4 rows × 5 columns

export const TAG_COLORS = [
  // Row 1 - Warm colors
  { value: "oklch(0.65 0.2 25)", label: "Red" },
  { value: "oklch(0.7 0.18 55)", label: "Orange" },
  { value: "oklch(0.8 0.15 95)", label: "Yellow" },
  { value: "oklch(0.7 0.15 130)", label: "Lime" },
  { value: "oklch(0.65 0.18 150)", label: "Green" },

  // Row 2 - Cool colors
  { value: "oklch(0.6 0.15 190)", label: "Teal" },
  { value: "oklch(0.65 0.2 220)", label: "Cyan" },
  { value: "oklch(0.55 0.22 250)", label: "Blue" },
  { value: "oklch(0.5 0.2 280)", label: "Indigo" },
  { value: "oklch(0.55 0.2 310)", label: "Purple" },

  // Row 3 - Vibrant colors
  { value: "oklch(0.65 0.2 350)", label: "Pink" },
  { value: "oklch(0.7 0.15 15)", label: "Rose" },
  { value: "oklch(0.75 0.12 70)", label: "Amber" },
  { value: "oklch(0.7 0.12 160)", label: "Emerald" },
  { value: "oklch(0.6 0.18 210)", label: "Sky" },

  // Row 4 - Muted and neutral colors
  { value: "oklch(0.45 0.15 260)", label: "Navy" },
  { value: "oklch(0.55 0.18 290)", label: "Violet" },
  { value: "oklch(0.65 0.2 330)", label: "Fuchsia" },
  { value: "oklch(0.5 0.05 250)", label: "Slate" },
  { value: "oklch(0.55 0.02 0)", label: "Gray" },
] as const;

export type TagColor = (typeof TAG_COLORS)[number]["value"] | undefined;
