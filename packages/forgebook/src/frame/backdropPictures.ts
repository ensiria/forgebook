/**
 * Forgebook's backdrop pictures, and the style sheet that draws a backdrop behind a frame's story. Only the frame
 * imports this module: the shell knows a backdrop by its id, its name and its colour (`backdrops.ts`), so its first
 * load carries none of the pictures.
 *
 * @remarks
 * Every picture is drawn here in CSS gradients and inline SVG: no image file, nothing fetched, nothing of the library
 * the catalogue shows, invented words only. The sheet replaces the `body` background the story's source sets, so the
 * story's own layout and colours are unchanged; with forced colours it draws nothing, and the system's palette decides
 * the page. Pure.
 *
 * @module
 */
import { type Backdrop, BUILT_IN_COLORS, type BuiltInBackdropId, type SchemePair } from "../backdrops.ts";

/**
 * A text written inside an SVG document, with the characters XML reserves escaped.
 *
 * @param text - the text.
 */
const xmlText = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/**
 * An SVG document as a CSS image.
 *
 * @param width - the picture's width, in its own units.
 * @param height - the picture's height, in its own units.
 * @param content - the SVG elements inside the root.
 */
const svgImage = (width: number, height: number, content: string): string => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice">${content}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

/**
 * The same layers in both themes: a picture that does not follow the theme.
 *
 * @param layers - the picture's layers.
 */
const fixed = (layers: string): SchemePair => ({ light: layers, dark: layers });

/** The checkerboard: grey and white squares of 8 px, the usual sign of a transparent picture. */
const CHECKERBOARD = "repeating-conic-gradient(#d6d6d6 0% 25%, #ffffff 0% 50%) 0 0 / 16px 16px";

/** The vivid picture's shapes, in its tile of 480 px. */
const VIVID_SHAPES = svgImage(
  480,
  480,
  '<circle cx="96" cy="104" r="64" fill="#ffd60a"/>' +
    '<circle cx="372" cy="336" r="88" fill="#22d3ee"/>' +
    '<rect x="248" y="56" width="176" height="56" rx="28" fill="#ffffff" fill-opacity="0.85"/>' +
    '<rect x="40" y="300" width="56" height="140" rx="12" fill="#34d399"/>' +
    '<path d="M150 240 L330 240 L240 420 Z" fill="#ff4d8d"/>' +
    '<g stroke="#111827" stroke-width="10" stroke-opacity="0.55">' +
    '<line x1="300" y1="160" x2="460" y2="160"/><line x1="300" y1="190" x2="460" y2="190"/>' +
    '<line x1="300" y1="220" x2="460" y2="220"/></g>'
);

/**
 * The vivid picture: crisp circles, bars and stripes on a saturated gradient, the shapes repeated every 480 px, so a
 * surface's blur shows on sharp edges wherever it sits.
 */
const GRADIENT = `${VIVID_SHAPES} 0 0 / 480px 480px repeat, linear-gradient(135deg, #5b21b6 0%, #db2777 55%, #f97316 100%)`;

/**
 * Rolling hills under a sky, the shape of a desktop picture.
 *
 * @param colors - the sky's two colours, top and bottom, a glow's colour, and the three hills', back to front.
 */
const hills = (colors: {
  readonly skyTop: string;
  readonly skyBottom: string;
  readonly glow: string;
  readonly hills: readonly [string, string, string];
}): string =>
  svgImage(
    1600,
    1000,
    '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">' +
      `<stop offset="0" stop-color="${colors.skyTop}"/><stop offset="1" stop-color="${colors.skyBottom}"/>` +
      '</linearGradient><radialGradient id="glow" cx="0.72" cy="0.3" r="0.4">' +
      `<stop offset="0" stop-color="${colors.glow}" stop-opacity="0.9"/>` +
      `<stop offset="1" stop-color="${colors.glow}" stop-opacity="0"/></radialGradient></defs>` +
      '<rect width="1600" height="1000" fill="url(#sky)"/>' +
      '<rect width="1600" height="1000" fill="url(#glow)"/>' +
      `<path d="M0 560 C260 470 520 640 820 560 S1360 430 1600 520 L1600 1000 L0 1000 Z" fill="${colors.hills[0]}"/>` +
      `<path d="M0 700 C320 600 640 780 960 690 S1420 600 1600 660 L1600 1000 L0 1000 Z" fill="${colors.hills[1]}"/>` +
      `<path d="M0 840 C360 760 700 900 1040 830 S1460 760 1600 800 L1600 1000 L0 1000 Z" fill="${colors.hills[2]}"/>`
  );

/** The light desktop: pale hills under a morning sky. */
const LIGHT_DESKTOP = `${hills({
  skyTop: "#cfe0fa",
  skyBottom: "#f8e6ee",
  glow: "#fff4d6",
  hills: ["#b7cdf0", "#e8b9cf", "#9fc9b4"]
})} center / cover no-repeat`;

/** The dark desktop: deep hills under a night sky with a violet glow. */
const DARK_DESKTOP = `${hills({
  skyTop: "#070b1a",
  skyBottom: "#1d1547",
  glow: "#7c3aed",
  hills: ["#23306b", "#3b2a7a", "#0f3a55"]
})} center / cover no-repeat`;

/** The colours of the page of content in one theme. */
type PagePalette = {
  /** The page. */
  readonly page: string;
  /** The text. */
  readonly text: string;
  /** The secondary text. */
  readonly secondary: string;
  /** The lines between rows. */
  readonly divider: string;
  /** The rows' icons, in their order. */
  readonly icons: readonly [string, string, string, string];
};

/** A paragraph of the page, one line per entry: SVG text does not wrap. */
const PARAGRAPH: readonly string[] = [
  "Start the tomatoes indoors six weeks before the last frost, then move",
  "them out once the nights stay warm. Keep the herbs near the kitchen",
  "door, where they are easy to reach, and the squash at the far end."
];

/** The rows of the page: a title, a line under it, a value at the end. */
const ROWS: readonly (readonly [string, string, string])[] = [
  ["Seed trays", "Delivered on Tuesday", "12"],
  ["Watering schedule", "Every other morning", "3 zones"],
  ["Compost bins", "Turned last week", "2"],
  ["Tool shed", "Needs a new hinge", "1 task"]
];

/** The font of the page's text: the system's, the only one a picture drawn as an image can use. */
const PAGE_FONT = "system-ui, -apple-system, Segoe UI, sans-serif";

/**
 * A page of content as an app shows it, in a tile of 720 × 600 px repeated: a heading, a paragraph, a coloured
 * picture and a list of rows.
 *
 * @param palette - the theme's colours.
 */
const contentPage = (palette: PagePalette): string => {
  const paragraph = PARAGRAPH.map(
    (line, index) =>
      `<text x="40" y="${104 + index * 24}" font-size="15" fill="${palette.text}">${xmlText(line)}</text>`
  ).join("");
  const rows = ROWS.map(([title, detail, value], index) => {
    const top = 312 + index * 68;
    const icon = palette.icons[index] ?? palette.secondary;
    return (
      `<rect x="40" y="${top + 12}" width="36" height="36" rx="8" fill="${icon}"/>` +
      `<text x="92" y="${top + 27}" font-size="15" font-weight="600" fill="${palette.text}">${xmlText(title)}</text>` +
      `<text x="92" y="${top + 47}" font-size="13" fill="${palette.secondary}">${xmlText(detail)}</text>` +
      `<text x="680" y="${top + 36}" font-size="14" text-anchor="end" fill="${palette.secondary}">` +
      `${xmlText(value)}</text>` +
      `<line x1="40" y1="${top + 64}" x2="680" y2="${top + 64}" stroke="${palette.divider}"/>`
    );
  }).join("");
  return `${svgImage(
    720,
    600,
    `<rect width="720" height="600" fill="${palette.page}"/>` +
      `<g font-family="${PAGE_FONT}">` +
      `<text x="40" y="64" font-size="26" font-weight="700" fill="${palette.text}">Spring garden plan</text>` +
      paragraph +
      '<defs><linearGradient id="picture" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#4f7cff"/><stop offset="0.5" stop-color="#a855f7"/>' +
      '<stop offset="1" stop-color="#f97316"/></linearGradient></defs>' +
      '<rect x="40" y="184" width="640" height="104" rx="12" fill="url(#picture)"/>' +
      '<circle cx="600" cy="236" r="30" fill="#ffd60a"/>' +
      rows +
      "</g>"
  )} 0 0 / 720px 600px repeat`;
};

/** The page of content, in both schemes, on the page's colour for each. */
const CONTENT: SchemePair = {
  light: contentPage({
    page: BUILT_IN_COLORS.content.light,
    text: "#1f2328",
    secondary: "#656d76",
    divider: "#d8dee4",
    icons: ["#4f7cff", "#22c55e", "#f59e0b", "#ec4899"]
  }),
  dark: contentPage({
    page: BUILT_IN_COLORS.content.dark,
    text: "#e6e8eb",
    secondary: "#9aa1ab",
    divider: "#2d3139",
    icons: ["#6b8cff", "#34d399", "#fbbf24", "#f472b6"]
  })
};

/** The layers of each of Forgebook's pictures, in each scheme. */
export const BUILT_IN_PICTURES: Readonly<Record<BuiltInBackdropId, SchemePair>> = {
  checkerboard: fixed(CHECKERBOARD),
  gradient: fixed(GRADIENT),
  lightDesktop: fixed(LIGHT_DESKTOP),
  darkDesktop: fixed(DARK_DESKTOP),
  content: CONTENT
};

/**
 * A `body` rule that draws a backdrop's layers on its colour over whatever background the source's sheets set.
 *
 * @param layers - the layers.
 * @param color - the colour under them.
 */
const bodyRule = (layers: string, color: string): string =>
  `body { background: ${layers}, ${color} !important; }`;

/**
 * The style sheet that draws a backdrop behind a frame's story.
 *
 * @remarks
 * The rule sits on `body`, where the sources set their page colour, and wins over it with `!important`, so the
 * story's own elements keep every colour they set. The dark look follows the scheme the view draws in (its colour
 * scheme switch's, `switches.ts`), the system's preference for `system`; with forced colours the sheet draws nothing.
 *
 * @param backdrop - the backdrop; none for the page's own colour.
 * @param scheme - the scheme the story is drawn in.
 * @returns the CSS; empty for the page's own colour.
 */
export const backdropSheet = (
  backdrop: Backdrop | undefined,
  scheme: "light" | "dark" | "system"
): string => {
  if (backdrop === undefined) return "";
  const layers = backdrop.kind === "own" ? backdrop.layers : BUILT_IN_PICTURES[backdrop.id];
  const light = bodyRule(layers.light, backdrop.colors.light);
  const dark = bodyRule(layers.dark, backdrop.colors.dark);
  if (light === dark || scheme === "light") return `@media (forced-colors: none) { ${light} }`;
  if (scheme === "dark") return `@media (forced-colors: none) { ${dark} }`;
  return [
    `@media (forced-colors: none) { ${light} }`,
    `@media (forced-colors: none) and (prefers-color-scheme: dark) { ${dark} }`
  ].join("\n");
};
