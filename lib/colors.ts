// Categorical palette drawn from a standard Risograph ink chart - the ~16
// stock drum colors (Bright Red, Fluorescent Pink, Blue, Fluorescent
// Orange, Yellow, Green, Purple, Teal, Orange, Violet, Gold, Mint,
// Cornflower, Lemon, Coral, Lavender) go to the 16 highest-count categories.
// Riso ink names are real, specific, and unevenly spaced around the wheel -
// the opposite of an evenly-stepped generated hue wheel, which is what
// makes a categorical palette read as chosen rather than computed. The
// darker inks in the standard set (Burgundy, Brown, Navy/Federal Blue,
// Black, Grey) are deliberately excluded - they all but disappear against
// this app's near-black background, which is exactly what sank the earlier
// earthy palette. The remaining categories are filled with generated hues
// at the same bright, ink-like saturation/lightness so nothing reads as a
// duller outlier next to the named set.
const CATEGORY_COLORS: Record<string, string> = {
  "Podcast / Radio": "#FF1C42", // Bright Red
  "Listening Room / Bar": "#FF48B0", // Fluorescent Pink
  Publication: "#0078BF", // Blue
  Agency: "#FF7300", // Fluorescent Orange
  Photographer: "#FFE800", // Yellow
  "Audio Hardware": "#0F9E9C", // Teal / Aqua
  "Writer / Editor": "#4FA65C", // Green
  Designer: "#8560A8", // Purple
  "Content Creator": "#F0A028", // Orange
  "Museum / Institution": "#7A52C9", // Violet
  "Journalist / Critic": "#D4A828", // Gold
  Institution: "#4FD1A5", // Mint
  "Brand / Studio": "#4F94D4", // Cornflower
  "Director / Filmmaker": "#F5F04A", // Fluorescent Yellow / Lemon
  "Newsletter / Blog": "#FF6B57", // Coral
  "Retailer / Store": "#B48CE0", // Lavender
  "Art Director": "#3CDD8C",
  Publisher: "#E98C49",
  "Festival / Event": "#E07BE0",
  "PR / Agency": "#44AFE4",
  "Creative Director": "#EC516A",
  Stylist: "#8ACF59",
  Fashion: "#B768DF",
  "DJ / Producer": "#5269E0",
  "Artist / Illustrator": "#D7E444",
  "Music Journalist": "#2DD2B7",
  "Music Supervisor": "#5D95E5",
  "Venue / Space": "#8B64D8",
  Curator: "#ECB13C",
  Other: "#ADADAD",
  "Artist / DJ": "#3BCE60",
  Publicist: "#E36DB2",
  "Fashion Production": "#E45E44",
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function clampByte(v: number): number {
  return Math.round(Math.min(255, Math.max(0, v)));
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

// Fallback for any category not in the table above (e.g. added to the sheet
// later) - same bright, ink-like saturation/lightness floor as the curated
// riso palette, so a new category still reads as legible against the
// near-black background rather than reverting to something duller.
function generatedColor(category: string): string {
  const hue = hashString(category) % 360;
  const lightness = 0.54 + (hashString(category + "l") % 16) / 100;
  return hslToHex(hue, 0.78, lightness);
}

const cache = new Map<string, string>();

export function colorForCategory(category: string): string {
  if (cache.has(category)) return cache.get(category)!;
  const color = CATEGORY_COLORS[category] ?? generatedColor(category);
  cache.set(category, color);
  return color;
}

// A brighter tint of a hex color, used only for the selection glow/ring/
// burst in the graph canvas - the node's flat fill stays its base category
// color, this is what makes the "you are here" marker read as distinct
// from it rather than blending in.
export function lightenColor(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

// A darker shade of a hex color, used alongside lightenColor to build the
// subtle top-lit gradients on pills and nodes.
export function darkenColor(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

// A high-contrast top-lit linear gradient for a category's solid pill fill -
// a bright glint at the top edge dropping sharply through the base color to
// a near-black shadow at the bottom, for a glossy, high-voltage feel rather
// than a flat block of color.
export function pillGradient(category: string): string {
  const base = colorForCategory(category);
  return `linear-gradient(155deg, ${lightenColor(base, 0.55)} 0%, ${base} 45%, ${darkenColor(base, 0.55)} 100%)`;
}

// Black or white (whichever contrasts more), for text sitting on a solid
// fill of this color - standard WCAG relative-luminance pick, so a light
// swatch (e.g. Icterine yellow) gets dark text and a dark swatch (e.g.
// deep violet) gets light text automatically.
export function contrastTextColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.5 ? "#0b0a09" : "#ffffff";
}

// The selection glow/ring/burst color for a category, as an rgba() string
// ready for canvas fillStyle/strokeStyle/shadowColor use. `mix` controls how
// far it's lightened toward white - a low mix keeps the ray fringe tinted
// with the category hue, a high mix (~0.8+) gives the near-white hot core
// the reference burst has.
export function glowColorForCategory(category: string, alpha: number, mix: number = 0.45): string {
  const [r, g, b] = hexToRgb(lightenColor(colorForCategory(category), mix));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
