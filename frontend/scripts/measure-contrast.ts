function sRGBtoLinear(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
}

function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function blend(fgHex: string, bgHex: string, alpha: number): string {
  const fg = fgHex.replace("#", "");
  const bg = bgHex.replace("#", "");
  const r1 = parseInt(fg.substring(0, 2), 16);
  const g1 = parseInt(fg.substring(2, 4), 16);
  const b1 = parseInt(fg.substring(4, 6), 16);
  const r2 = parseInt(bg.substring(0, 2), 16);
  const g2 = parseInt(bg.substring(2, 4), 16);
  const b2 = parseInt(bg.substring(4, 6), 16);

  const r = Math.round(r1 * alpha + r2 * (1 - alpha));
  const g = Math.round(g1 * alpha + g2 * (1 - alpha));
  const b = Math.round(b1 * alpha + b2 * (1 - alpha));

  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
}

// Light theme tokens
const lightPage = "#E4E6E0";
const lightSurface = "#F3F4F0";
const lightTouchstone = "#2A3431";

// Dark theme tokens
const darkPage = "#22282A";
const darkSurface = "#2A3234";
const darkTouchstone = "#172220";

console.log("=== ANNOTATION TAG CONTRAST ANALYSIS ===");

// High-contrast tokens for AA compliance
const lightVerdigrisTag = "#2E5F53";
const lightMadderTag = "#983E2D";
const lightGoldTag = "#7E5B15";
const lightMuted = "#586360";

const pairs = [
  // Touchstone slab hero tags (light mode touchstone is dark basalt #2A3431)
  { name: "Touchstone Gold Petal on Slab (Light Theme)", fg: "#EED9A0", bg: lightTouchstone },
  { name: "Touchstone Gold Petal on Slab (Dark Theme)", fg: "#EED9A0", bg: darkTouchstone },
  { name: "Touchstone Verdigris text on Slab (Light Theme)", fg: "#72B7A5", bg: lightTouchstone },
  { name: "Touchstone Verdigris text on Slab (Dark Theme)", fg: "#72B7A5", bg: darkTouchstone },
  { name: "Touchstone White 80% on Slab (Light Theme)", fg: blend("#FFFFFF", lightTouchstone, 0.8), bg: lightTouchstone },
  { name: "Sample Banner text on Surface (Light Theme - #586360)", fg: lightMuted, bg: lightSurface },
  { name: "Sample Banner text on Surface (Dark Theme - #9AA5A1)", fg: "#9AA5A1", bg: darkSurface },
  // Verdigris badges on page
  { name: "Verdigris Tag on Light Page (#2E5F53 on #E4E6E0)", fg: lightVerdigrisTag, bg: lightPage },
  { name: "Verdigris Tag on Light Surface (#2E5F53 on #F3F4F0)", fg: lightVerdigrisTag, bg: lightSurface },
  { name: "Verdigris Tag on Dark Page (#72B7A5 on #22282A)", fg: "#72B7A5", bg: darkPage },
  { name: "Verdigris Tag on Dark Surface (#72B7A5 on #2A3234)", fg: "#72B7A5", bg: darkSurface },
  // Madder badges on page
  { name: "Madder Tag on Light Page (#983E2D on #E4E6E0)", fg: lightMadderTag, bg: lightPage },
  { name: "Madder Tag on Light Surface (#983E2D on #F3F4F0)", fg: lightMadderTag, bg: lightSurface },
  { name: "Madder Tag on Dark Page (#DE8570 on #22282A)", fg: "#DE8570", bg: darkPage },
  { name: "Madder Tag on Dark Surface (#DE8570 on #2A3234)", fg: "#DE8570", bg: darkSurface },
  // Gold badges on page
  { name: "Gold Tag on Light Page (#7E5B15 on #E4E6E0)", fg: lightGoldTag, bg: lightPage },
  { name: "Gold Tag on Light Surface (#7E5B15 on #F3F4F0)", fg: lightGoldTag, bg: lightSurface },
  { name: "Gold Tag on Dark Page (#D8B358 on #22282A)", fg: "#D8B358", bg: darkPage },
  { name: "Gold Tag on Dark Surface (#D8B358 on #2A3234)", fg: "#D8B358", bg: darkSurface },
];

for (const p of pairs) {
  const cr = contrastRatio(p.fg, p.bg);
  const passAA = cr >= 4.5;
  console.log(`${p.name}: ${cr.toFixed(2)}:1 [${passAA ? "PASS AA" : "FAIL AA"}]`);
}
