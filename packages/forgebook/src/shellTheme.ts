/**
 * A catalogue's theme of the shell, as the custom properties the shell's style sheets read, with what is wrong with it.
 *
 * @remarks
 * Nothing here runs in the browser: the plugin writes the theme into the shell's page at build, so a catalogue with no
 * theme gets no bytes and one with a theme no script. The frames belong to the stories and get none of it, but for the
 * one thing of Forgebook's they draw: the box that says a story failed. The shell's sheet sits in a cascade layer, so the page's unlayered rules outrank it whatever loads first; for that reason
 * each palette is scoped to its own appearance, or a light colour would reach the dark one. The default palettes are
 * also the style sheets' (`styles/_tokens.scss`, not shipped): the contrast of a partial theme needs what it leaves
 * unset, and a test holds the two equal. Layout is not themable: it is what the shell's own tests hold.
 *
 * @module
 */
import type { ShellPalette, ShellTheme } from "./shellTheme.types.ts";

/** A palette, by role. */
type Palette = Readonly<Record<string, string>>;

/** The shell's light palette, every role. */
export const LIGHT_PALETTE: Palette = {
  window: "#f6f6f8",
  sidebar: "#ebebef",
  surface: "#fff",
  fill: "#1d1d1f14",
  "fill-quiet": "#1d1d1f0d",
  hover: "#1d1d1f0a",
  separator: "#1d1d1f17",
  text: "#1d1d1f",
  "text-secondary": "#56565d",
  "text-tertiary": "#6a6a71",
  accent: "#0a6cf0",
  "accent-text": "#0059d2",
  "on-accent": "#fff",
  "danger-text": "#bc1f16",
  "caution-text": "#935200",
  "positive-text": "#077229",
  "code-keyword": "#7036c4",
  "code-type": "#0059d2",
  "code-string": "#077229",
  "code-number": "#935200",
  "code-punctuation": "#6a6a71",
  "code-name": "#1d1d1f",
  edge: "#1d1d1f25",
  "edge-hover": "#1d1d1f3d",
  "edge-field": "#1d1d1f2e",
  "card-edge": "#0000000f",
  "card-edge-hover": "#0000001a",
  "shadow-soft": "#0000000d",
  "shadow-lift": "#00000012",
  "shadow-deep": "#0003",
  shade: "#1d1d1f33"
};

/** The shell's dark palette, every role. */
export const DARK_PALETTE: Palette = {
  window: "#161618",
  sidebar: "#1e1e21",
  surface: "#252529",
  fill: "#ffffff1f",
  "fill-quiet": "#ffffff12",
  hover: "#ffffff0f",
  separator: "#ffffff1a",
  text: "#f2f2f4",
  "text-secondary": "#b6b6bd",
  "text-tertiary": "#9d9da5",
  accent: "#1f6fe5",
  "accent-text": "#7ab3ff",
  "on-accent": "#fff",
  "danger-text": "#ff8a80",
  "caution-text": "#f2b46b",
  "positive-text": "#7fdc8f",
  "code-keyword": "#c9a8ff",
  "code-type": "#7ab3ff",
  "code-string": "#7fdc8f",
  "code-number": "#f2b46b",
  "code-punctuation": "#9d9da5",
  "code-name": "#f2f2f4",
  edge: "#ffffff26",
  "edge-hover": "#ffffff40",
  "edge-field": "#ffffff2e",
  "card-edge": "#ffffff17",
  "card-edge-hover": "#ffffff26",
  "shadow-soft": "#0000004d",
  "shadow-lift": "#00000066",
  "shadow-deep": "#00000080",
  shade: "#00000073"
};

/** The roles a theme can set, the rest being the shell's own. */
const THEME_ROLES: readonly (keyof ShellPalette)[] = [
  "window",
  "sidebar",
  "surface",
  "separator",
  "hover",
  "text",
  "text-secondary",
  "text-tertiary",
  "accent",
  "accent-text",
  "danger-text",
  "caution-text",
  "positive-text",
  "code-keyword",
  "code-type",
  "code-string",
  "code-number",
  "code-punctuation",
  "code-name"
];

/** The contrast text needs, WCAG 2.1 AA for body text. */
const TEXT_CONTRAST = 4.5;

/** The contrast a focus ring needs against what it sits on, WCAG 2.1 AA for non-text. */
const FOCUS_CONTRAST = 3;

/** The text roles, each read on every ground. */
export const TEXT_ROLES = [
  "text",
  "text-secondary",
  "text-tertiary",
  "accent-text",
  "danger-text",
  "caution-text",
  "positive-text"
] as const;

/** The grounds text is read on. */
export const GROUND_ROLES = ["window", "sidebar", "surface"] as const;

/** The code roles, read on the code background. */
export const CODE_ROLES = [
  "code-keyword",
  "code-type",
  "code-string",
  "code-number",
  "code-punctuation",
  "code-name"
] as const;

/** What a plain CSS value never holds: what would end a declaration, a rule or the style block, or open a comment. */
const UNSAFE_VALUE = /[;{}<>\\]|\/\*/;

/** A record as custom properties, with a prefix; none for nothing. */
const declarations = (values: Readonly<Record<string, string | undefined>>, prefix: string): string =>
  Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `--forgebook-${prefix}${name}:${value}`)
    .join(";");

/** A rule, or nothing when it declares nothing. */
const rule = (selector: string, body: string): string => (body === "" ? "" : `${selector}{${body}}`);

/** The rules of a theme's fonts and corners, which hold in both appearances. */
const sharedCss = (theme: ShellTheme): string =>
  rule(
    ":root",
    [
      declarations({ sans: theme.fonts?.sans, mono: theme.fonts?.mono }, "font-"),
      declarations(
        {
          "control-small": theme.radius?.control,
          control: theme.radius?.control,
          card: theme.radius?.card
        },
        "radius-"
      )
    ]
      .filter((part) => part !== "")
      .join(";")
  );

/** The rules of a palette: its appearance, and the system's before the page has told which. */
const paletteCss = (
  colors: Readonly<Record<string, string | undefined>>,
  appearance: "light" | "dark"
): string => {
  const body = declarations(colors, "");
  if (body === "") return "";
  const system = appearance === "dark" ? "(prefers-color-scheme:dark)" : "not (prefers-color-scheme:dark)";
  return [
    `@media ${system}{${rule(":root:not([data-forgebook-appearance])", body)}}`,
    rule(`:root[data-forgebook-appearance="${appearance}"]`, body)
  ].join("");
};

/**
 * A theme as CSS, for the shell's page.
 *
 * @param theme - the theme.
 * @returns the rules; empty when the theme sets nothing.
 */
export const shellThemeCss = (theme: ShellTheme): string =>
  [sharedCss(theme), paletteCss(theme.light ?? {}, "light"), paletteCss(theme.dark ?? {}, "dark")].join("");

/**
 * What a frame needs of a theme: the box that says a story failed, and nothing a story could read. A frame draws in the
 * light palette whatever the shell's appearance.
 *
 * @param theme - the theme.
 * @returns the rule; empty when the theme sets nothing the box uses.
 */
export const frameThemeCss = (theme: ShellTheme): string =>
  rule(
    ".forgebook-frame-error",
    [
      declarations({ sans: theme.fonts?.sans, mono: theme.fonts?.mono }, "font-"),
      declarations(
        {
          "danger-text": theme.light?.["danger-text"],
          "text-secondary": theme.light?.["text-secondary"]
        },
        ""
      )
    ]
      .filter((part) => part !== "")
      .join(";")
  );

/**
 * Themes over each other, role by role, the last winning: a catalogue over its presets.
 *
 * @param themes - the themes, in order.
 */
export const mergedThemes = (themes: readonly ShellTheme[]): ShellTheme => {
  const merged = (field: "light" | "dark" | "fonts" | "radius"): Readonly<Record<string, string>> =>
    Object.assign({}, ...themes.map((theme) => theme[field]));
  return { light: merged("light"), dark: merged("dark"), fonts: merged("fonts"), radius: merged("radius") };
};

/** Whether a value's quotes and brackets close, or the rest of the sheet would be swallowed. */
const isBalanced = (value: string): boolean => {
  const unquoted = value.replace(/"[^"]*"|'[^']*'/g, "");
  if (/["']/.test(unquoted)) return false;
  let open = 0;
  for (const character of unquoted) {
    open += Number(character === "(") - Number(character === ")");
    if (open < 0) return false;
  }
  return open === 0;
};

/**
 * What in a theme cannot be written into a page.
 *
 * @param theme - the theme.
 * @returns the first value that is not a plain CSS value, named; none when all are.
 */
export const themeValueProblem = (theme: ShellTheme): string | undefined => {
  const groups = { light: theme.light, dark: theme.dark, fonts: theme.fonts, radius: theme.radius };
  for (const [group, values] of Object.entries(groups)) {
    for (const [name, value] of Object.entries(values ?? {})) {
      if (UNSAFE_VALUE.test(value) || !isBalanced(value)) {
        return `shell.theme: ${group}.${name} is not a plain CSS value`;
      }
    }
  }
  return undefined;
};

/** A hex colour's channels, 0 to 1, with its alpha; none for anything else, which is left unjudged. */
const channels = (color: string): readonly [number, number, number, number] | undefined => {
  const digits = /^#((?:[0-9a-f]{3,4}){1,2})$/i.exec(color.trim())?.[1];
  if (digits === undefined) return undefined;
  const full = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join("") : digits;
  const byte = (start: number): number => Number.parseInt(full.slice(start, start + 2), 16) / 255;
  return [byte(0), byte(2), byte(4), full.length === 8 ? byte(6) : 1];
};

/** An opaque colour. */
type Opaque = readonly [number, number, number];

/** A colour laid on an opaque one. */
const over = (top: readonly [number, number, number, number], ground: Opaque): Opaque => {
  const [r, g, b, alpha] = top;
  return [
    r * alpha + ground[0] * (1 - alpha),
    g * alpha + ground[1] * (1 - alpha),
    b * alpha + ground[2] * (1 - alpha)
  ];
};

/** The relative luminance of an opaque colour. */
const luminance = ([r, g, b]: Opaque): number => {
  const linear = (channel: number): number =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

/** Two opaque colours' contrast. */
const contrast = (first: Opaque, second: Opaque): number => {
  const [a, b] = [luminance(first), luminance(second)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/** Colours stacked from the bottom, as the page paints them; none when one cannot be read. */
const stacked = (palette: Palette, roles: readonly string[], canvas: Opaque): Opaque | undefined => {
  let ground = canvas;
  for (const role of roles) {
    const color = channels(palette[role] ?? "");
    if (color === undefined) return undefined;
    ground = over(color, ground);
  }
  return ground;
};

/** A foreground that falls under a contrast on a ground, as a line; none when it holds or cannot be read. */
const pairProblem = (
  appearance: string,
  palette: Palette,
  front: string,
  ground: readonly string[],
  minimum: number
): string | undefined => {
  const color = channels(palette[front] ?? "");
  const base = stacked(palette, ground, [1, 1, 1]);
  if (color === undefined || base === undefined) return undefined;
  const ratio = contrast(over(color, base), base);
  if (ratio >= minimum) return undefined;
  return `${appearance}: ${front} on ${ground.at(-1)} is ${ratio.toFixed(2)}:1, under ${minimum}:1`;
};

/** The ground a role paints on, from the page up. */
const groundStack = (role: string): readonly string[] => (role === "window" ? ["window"] : ["window", role]);

/** The pairs of a palette that fall under what they need. */
const paletteProblems = (appearance: string, palette: Palette): string[] =>
  [
    ...TEXT_ROLES.flatMap((text) =>
      GROUND_ROLES.map((ground) => pairProblem(appearance, palette, text, groundStack(ground), TEXT_CONTRAST))
    ),
    ...CODE_ROLES.map((role) =>
      pairProblem(appearance, palette, role, ["window", "surface", "fill-quiet"], TEXT_CONTRAST)
    ),
    ...GROUND_ROLES.map((ground) =>
      pairProblem(appearance, palette, "accent", groundStack(ground), FOCUS_CONTRAST)
    )
  ].filter((problem) => problem !== undefined);

/** The roles a theme sets that do not exist, or the role is written and nothing reads it. */
const unknownRoles = (appearance: string, colors: Readonly<Record<string, string>>): string[] =>
  Object.keys(colors)
    .filter((role) => !THEME_ROLES.some((known) => known === role))
    .map((role) => `${appearance}: "${role}" is not a role of the shell's theme`);

/**
 * What in a theme will not work: a role that does not exist, a text under 4.5:1 on a ground, code under 4.5:1 on its
 * background, or an accent under 3:1, since it draws the keyboard's focus. Colours that are not hex are left out: a wrong
 * warning teaches people to ignore the right ones.
 *
 * @param theme - the theme.
 * @returns one line per problem.
 */
export const shellThemeProblems = (theme: ShellTheme): string[] => [
  ...unknownRoles("light", theme.light ?? {}),
  ...unknownRoles("dark", theme.dark ?? {}),
  ...(Object.keys(theme.light ?? {}).length === 0
    ? []
    : paletteProblems("light", { ...LIGHT_PALETTE, ...theme.light })),
  ...(Object.keys(theme.dark ?? {}).length === 0
    ? []
    : paletteProblems("dark", { ...DARK_PALETTE, ...theme.dark }))
];
