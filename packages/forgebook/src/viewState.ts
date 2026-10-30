/**
 * The toolbar's switches as a value, read from and written to the URL, so a view is shared with a link and the
 * frames and the tests open the same address.
 *
 * @remarks
 * Only values that differ from the defaults are written; an unknown or invalid value reads as the default. The frame
 * turns the view into the attributes Kaji UI reads (`data-theme`, `data-contrast`, `data-motion-amount`,
 * `data-motion`, `data-press`), the style sheets,
 * the root font size and the backdrop Forgebook draws behind the story. The stage's width, height, zoom and tools and the panel (open, its tab) are the shell's alone: a frame's address leaves them
 * out. Pure.
 *
 * @module
 */

/** The theme: a fixed scheme, or the system's. */
export type ThemeChoice = "light" | "dark" | "system";

/**
 * How much motion plays: the system's (no attribute), or one of `data-motion-amount`'s values, from everything to
 * nothing; `reduced` plays as the system's Reduce Motion does.
 */
export type MotionChoice = "system" | "all" | "feedback" | "essential" | "reduced" | "off";

/** How fast motion plays: one of `data-motion`'s values; `normal` writes no attribute. */
export type SpeedChoice = "normal" | "slow" | "fast";

/**
 * What a held-down control does: the library's own default (no attribute), or one of `data-press`'s values (D-582):
 * a shrink, a darker fill, a darker fill without a hover fill, or no press feedback.
 */
export type PressChoice = "default" | "shrink" | "darken" | "darkenWithoutHover" | "off";

/**
 * What Forgebook draws behind the story, in place of its page's colour (D-644): the page's colour itself (`plain`,
 * following the theme), a checkerboard (transparency), a vivid gradient (glass and blur), a light and a dark
 * desktop-like picture (fixed, whatever the theme), or a page of content (text and rows, in the theme's light or
 * dark). Forgebook draws them itself, never the library it shows (D-67).
 */
export type BackdropChoice =
  | "plain"
  | "checkerboard"
  | "gradient"
  | "lightDesktop"
  | "darkDesktop"
  | "content";

/** Which style sheets the frame loads besides the required ones. */
export type SheetsChoice = "full" | "structure" | "restyled";

/** The root font size, in percent of the browser's: lengths in rem follow it. */
export type TextScale = 100 | 125 | 150;

/**
 * What the compare view sets side by side: the themes at both contrasts, the source's languages, the text sizes or
 * the style sheets; `off` shows the story once.
 */
export type CompareMode = "off" | "theme" | "language" | "text" | "sheets";

/** A tool drawn over the story: every element's outline, an 8 px grid, the box of the element under the pointer. */
export type MeasureTool = "outline" | "grid" | "measure";

/** The story's zoom on the stage, in percent: it scales the drawing, never the layout. */
export type Zoom = 50 | 75 | 100 | 125 | 150 | 200;

/** A tab of the panel under a story. */
export type PanelTab = "props" | "events" | "play" | "parts" | "code" | "a11y";

/** The story's width on the stage: the stage's whole width, or a width in CSS px (a preset, or dragged). */
export type StageWidth = "fill" | number;

/**
 * The story's height on the stage: its own (`auto`: the story's content, at least the height it declares) or a
 * height in CSS px dragged with the handle at its foot (note 142).
 */
export type StageHeight = "auto" | number;

/** Every switch of the toolbar. */
export type ViewState = {
  /** The theme. */
  readonly theme: ThemeChoice;
  /** Whether high contrast is on (`data-contrast="more"`); off is the standard level, not the system's. */
  readonly isMoreContrast: boolean;
  /** How much motion plays. */
  readonly motion: MotionChoice;
  /** How fast motion plays. */
  readonly speed: SpeedChoice;
  /** What a held-down control does. */
  readonly press: PressChoice;
  /** What is drawn behind the story. */
  readonly backdrop: BackdropChoice;
  /** The style sheets. */
  readonly sheets: SheetsChoice;
  /** The text size. */
  readonly text: TextScale;
  /** The id of one of the source's languages; empty for the stories' own text. */
  readonly language: string;
  /** What the stage compares side by side: nothing, or the story across one switch's values. */
  readonly compare: CompareMode;
  /** The story's width on the stage. */
  readonly width: StageWidth;
  /** The story's height on the stage. */
  readonly height: StageHeight;
  /** Whether the panel is shown under the story. */
  readonly isPanelOpen: boolean;
  /** The panel's tab; a tab the story has nothing for shows the first one it has. */
  readonly panelTab: PanelTab;
  /** The story's zoom. */
  readonly zoom: Zoom;
  /** The tools drawn over the story, in `MEASURE_TOOLS`' order. */
  readonly tools: readonly MeasureTool[];
};

/** The part of the view a frame applies on its root without loading again, so the story keeps its state. */
export type LiveView = Pick<
  ViewState,
  "theme" | "isMoreContrast" | "motion" | "speed" | "press" | "backdrop" | "text"
>;

/** The view without any change. */
export const DEFAULT_VIEW: ViewState = {
  theme: "light",
  isMoreContrast: false,
  motion: "system",
  speed: "normal",
  press: "default",
  backdrop: "plain",
  sheets: "full",
  text: 100,
  language: "",
  compare: "off",
  width: "fill",
  height: "auto",
  isPanelOpen: true,
  panelTab: "props",
  zoom: 100,
  tools: []
};

/** Every value of each choice, in the toolbar's order. */
export const THEME_CHOICES: readonly ThemeChoice[] = ["light", "dark", "system"];

/** Every motion amount, in the menu's order. */
export const MOTION_CHOICES: readonly MotionChoice[] = [
  "system",
  "all",
  "feedback",
  "essential",
  "reduced",
  "off"
];

/** Every speed, in the menu's order. */
export const SPEED_CHOICES: readonly SpeedChoice[] = ["slow", "normal", "fast"];

/** Every press feedback, in the menu's order. */
export const PRESS_CHOICES: readonly PressChoice[] = [
  "default",
  "shrink",
  "darken",
  "darkenWithoutHover",
  "off"
];

/** Every backdrop, in the menu's order. */
export const BACKDROP_CHOICES: readonly BackdropChoice[] = [
  "plain",
  "checkerboard",
  "gradient",
  "lightDesktop",
  "darkDesktop",
  "content"
];

/** Every style sheet setting, in the menu's order. */
export const SHEETS_CHOICES: readonly SheetsChoice[] = ["full", "structure", "restyled"];

/** Every text size, in the menu's order. */
export const TEXT_SCALES: readonly TextScale[] = [100, 125, 150];

/** Every compare mode, in the menu's order. */
export const COMPARE_MODES: readonly CompareMode[] = ["off", "theme", "language", "text", "sheets"];

/**
 * The compare mode a parameter names: `1`, the form older addresses wrote, is the themes.
 *
 * @param value - the `compare` parameter.
 */
const compareMode = (value: string | null): CompareMode =>
  value === "1" ? "theme" : choice(value, COMPARE_MODES, DEFAULT_VIEW.compare);

/**
 * Whether the stage compares the story across a switch's values.
 *
 * @param view - the view.
 */
export const isComparing = (view: ViewState): boolean => view.compare !== "off";

/** Every zoom, in the menu's order. */
export const ZOOMS: readonly Zoom[] = [50, 75, 100, 125, 150, 200];

/** Every tool, in the bar's order. */
export const MEASURE_TOOLS: readonly MeasureTool[] = ["outline", "grid", "measure"];

/** The tools a parameter names (`outline,measure`), in their order; unknown names are left out. */
const toolsOf = (value: string | null): MeasureTool[] => {
  const names = (value ?? "").split(",");
  return MEASURE_TOOLS.filter((tool) => names.includes(tool));
};

/** The panel's tabs, in its order. */
export const PANEL_TABS: readonly PanelTab[] = ["props", "events", "play", "parts", "code", "a11y"];

/** The stage's preset widths, in CSS px: a phone, the stage beside the props panel (the tests' narrow variant), a tablet, a laptop. */
export const STAGE_WIDTHS: readonly number[] = [360, 560, 768, 1024];

/** The narrowest and widest story a width in the address or a drag may set, in CSS px. */
export const STAGE_WIDTH_RANGE = { min: 240, max: 2560 } as const;

/**
 * A width kept in the range, in whole pixels.
 *
 * @param width - a width in CSS px.
 */
export const clampedWidth = (width: number): number =>
  Math.round(Math.min(STAGE_WIDTH_RANGE.max, Math.max(STAGE_WIDTH_RANGE.min, width)));

/** The width a parameter names: a whole number of px in the range, otherwise the stage's whole width. */
const stageWidth = (value: string | null): StageWidth => {
  const width = Number(value);
  return value !== null && Number.isInteger(width) && clampedWidth(width) === width ? width : "fill";
};
/** The lowest and highest story a height in the address or a drag may set, in CSS px. */
export const STAGE_HEIGHT_RANGE = { min: 48, max: 4000 } as const;

/**
 * A height kept in the range, in whole pixels.
 *
 * @param height - a height in CSS px.
 */
export const clampedHeight = (height: number): number =>
  Math.round(Math.min(STAGE_HEIGHT_RANGE.max, Math.max(STAGE_HEIGHT_RANGE.min, height)));

/** The height a parameter names: a whole number of px in the range, otherwise the story's own. */
const stageHeight = (value: string | null): StageHeight => {
  const height = Number(value);
  return value !== null && Number.isInteger(height) && clampedHeight(height) === height ? height : "auto";
};

/** The value of a parameter when it is one of the choices, otherwise the default. */
const choice = <TChoice extends string | number>(
  value: string | null,
  choices: readonly TChoice[],
  fallback: TChoice
): TChoice => choices.find((option) => String(option) === value) ?? fallback;

/**
 * The view a URL's query describes.
 *
 * @param search - the query (`?theme=dark&motion=reduced`), with or without `?`.
 */
export const parseView = (search: string): ViewState => {
  const params = new URLSearchParams(search);
  return {
    theme: choice(params.get("theme"), THEME_CHOICES, DEFAULT_VIEW.theme),
    isMoreContrast: params.get("contrast") === "more",
    motion: choice(params.get("motion"), MOTION_CHOICES, DEFAULT_VIEW.motion),
    speed: choice(params.get("speed"), SPEED_CHOICES, DEFAULT_VIEW.speed),
    press: choice(params.get("press"), PRESS_CHOICES, DEFAULT_VIEW.press),
    backdrop: choice(params.get("backdrop"), BACKDROP_CHOICES, DEFAULT_VIEW.backdrop),
    sheets: choice(params.get("sheets"), SHEETS_CHOICES, DEFAULT_VIEW.sheets),
    text: choice(params.get("text"), TEXT_SCALES, DEFAULT_VIEW.text),
    // checked against the story's source by the frame: an id it does not offer draws the stories' own text
    language: params.get("lang") ?? DEFAULT_VIEW.language,
    compare: compareMode(params.get("compare")),
    width: stageWidth(params.get("width")),
    height: stageHeight(params.get("height")),
    isPanelOpen: params.get("panel") !== "closed",
    panelTab: choice(params.get("tab"), PANEL_TABS, DEFAULT_VIEW.panelTab),
    zoom: choice(params.get("zoom"), ZOOMS, DEFAULT_VIEW.zoom),
    tools: toolsOf(params.get("tools"))
  };
};

/** The parameters a frame's document reads: only what differs from the defaults. */
const frameParams = (view: ViewState): URLSearchParams => {
  const params = new URLSearchParams();
  if (view.theme !== DEFAULT_VIEW.theme) params.set("theme", view.theme);
  if (view.isMoreContrast) params.set("contrast", "more");
  if (view.motion !== DEFAULT_VIEW.motion) params.set("motion", view.motion);
  if (view.speed !== DEFAULT_VIEW.speed) params.set("speed", view.speed);
  if (view.press !== DEFAULT_VIEW.press) params.set("press", view.press);
  if (view.backdrop !== DEFAULT_VIEW.backdrop) params.set("backdrop", view.backdrop);
  if (view.sheets !== DEFAULT_VIEW.sheets) params.set("sheets", view.sheets);
  if (view.text !== DEFAULT_VIEW.text) params.set("text", String(view.text));
  if (view.language !== DEFAULT_VIEW.language) params.set("lang", view.language);
  return params;
};

/**
 * The query parameters of a view: only what differs from the defaults.
 *
 * @param view - the view.
 * @returns the parameters, in a stable order.
 */
export const viewParams = (view: ViewState): URLSearchParams => {
  const params = frameParams(view);
  if (view.compare !== DEFAULT_VIEW.compare) params.set("compare", view.compare);
  if (view.width !== DEFAULT_VIEW.width) params.set("width", String(view.width));
  if (view.height !== DEFAULT_VIEW.height) params.set("height", String(view.height));
  if (!view.isPanelOpen) params.set("panel", "closed");
  if (view.panelTab !== DEFAULT_VIEW.panelTab) params.set("tab", view.panelTab);
  if (view.zoom !== DEFAULT_VIEW.zoom) params.set("zoom", String(view.zoom));
  if (view.tools.length > 0) params.set("tools", view.tools.join(","));
  return params;
};

/**
 * Whether one of the View menu's settings (motion, speed, press, background, style sheets, text size, language) is
 * changed: the menu button then shows a dot, so a view is never left changed by mistake.
 *
 * @param view - the view.
 */
export const hasViewChanges = (view: ViewState): boolean =>
  view.motion !== DEFAULT_VIEW.motion ||
  view.speed !== DEFAULT_VIEW.speed ||
  view.press !== DEFAULT_VIEW.press ||
  view.backdrop !== DEFAULT_VIEW.backdrop ||
  view.sheets !== DEFAULT_VIEW.sheets ||
  view.text !== DEFAULT_VIEW.text ||
  view.language !== DEFAULT_VIEW.language;

/**
 * The address of a story's frame.
 *
 * @param frameUrl - the frame page (`frame.html`).
 * @param id - the story's id.
 * @param view - the view; what only the shell reads (compare, the stage's width, the panel) is left out.
 */
export const frameAddress = (frameUrl: string, id: string, view: ViewState): string => {
  const params = frameParams(view);
  params.set("story", id);
  return `${frameUrl}?${params.toString()}`;
};

/**
 * The part of a view a frame applies live.
 *
 * @param view - the view.
 */
export const liveView = (view: ViewState): LiveView => ({
  theme: view.theme,
  isMoreContrast: view.isMoreContrast,
  motion: view.motion,
  speed: view.speed,
  press: view.press,
  backdrop: view.backdrop,
  text: view.text
});
