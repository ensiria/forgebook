/**
 * The toolbar's switches as a value, read from and written to the URL, so a view is shared with a link and the
 * frames and the tests open the same address.
 *
 * @remarks
 * Only values that differ from the defaults are written; an unknown or invalid value reads as the default. The view
 * holds a value for each switch the catalogue declares (`switches.ts`: the theme, the contrast, the language, the
 * library's own), which the frame applies on its root or hands the story; and Forgebook's own settings: the style
 * sheets, the root font size and the backdrop Forgebook draws behind the story. The stage's width, height, zoom and tools and the panel (open, its tab) are the shell's alone: a frame's address leaves them
 * out. Pure.
 *
 * @module
 */

import { switchValueOf, switchWithRole, type ViewSwitch } from "./switches";

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
 * What the compare view sets side by side: the values of one switch, or of two (the theme at both contrasts), or
 * Forgebook's text sizes or style sheets; none shows the story once. Each is a switch's id, `text` or `sheets`.
 */
export type CompareAxes = readonly string[];

/** Forgebook's own settings the compare view can set side by side. */
export const OWN_COMPARE_AXES = ["text", "sheets"] as const;

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
  /** Each declared switch's value, by the switch's id; a switch the address leaves out has its default. */
  readonly switches: Readonly<Record<string, string>>;
  /** What is drawn behind the story. */
  readonly backdrop: BackdropChoice;
  /** The style sheets. */
  readonly sheets: SheetsChoice;
  /** The text size. */
  readonly text: TextScale;
  /** What the stage compares side by side: nothing (empty), or the story across one or two switches' values. */
  readonly compare: CompareAxes;
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
export type LiveView = Pick<ViewState, "switches" | "backdrop" | "text">;

/** The view without any change. */
export const DEFAULT_VIEW: ViewState = {
  switches: {},
  backdrop: "plain",
  sheets: "full",
  text: 100,
  compare: [],
  width: "fill",
  height: "auto",
  isPanelOpen: true,
  panelTab: "props",
  zoom: 100,
  tools: []
};

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

/**
 * Whether the stage compares the story across a switch's values.
 *
 * @param view - the view.
 */
export const isComparing = (view: ViewState): boolean => view.compare.length > 0;

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
 * Each declared switch's value an address names, the default for one it leaves out or names wrongly.
 *
 * @param params - the address's parameters.
 * @param switches - the declared switches.
 */
const switchValuesOf = (
  params: URLSearchParams,
  switches: readonly ViewSwitch[]
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    switches.map((each) => [
      each.id,
      switchValueOf(each, params.get(each.id) ?? undefined)?.value ?? each.default
    ])
  );

/**
 * The compared axes a `compare` parameter names: one or two switch ids, `text` or `sheets`. `theme` (and `1`, the form
 * older addresses wrote) is the colour scheme at both contrasts, `language` the language switch, as the toolbar
 * named them before switches were declared.
 *
 * @param value - the parameter.
 * @param switches - the declared switches.
 */
const compareAxesOf = (value: string | null, switches: readonly ViewSwitch[]): CompareAxes => {
  if (value === null || value === "") return [];
  const scheme = switchWithRole(switches, "colorScheme");
  const contrast = switchWithRole(switches, "contrast");
  const legacy: Readonly<Record<string, readonly (string | undefined)[]>> = {
    "1": [scheme?.id, contrast?.id],
    theme: [scheme?.id, contrast?.id],
    language: [switchWithRole(switches, "language")?.id]
  };
  const named = legacy[value] ?? value.split(",");
  const known = [...switches.map((each) => each.id), ...OWN_COMPARE_AXES];
  return named.filter((axis): axis is string => axis !== undefined && known.includes(axis)).slice(0, 2);
};

/**
 * The view a URL's query describes.
 *
 * @param search - the query (`?theme=dark&motion=reduced`), with or without `?`.
 * @param switches - the catalogue's switches.
 */
export const parseView = (search: string, switches: readonly ViewSwitch[]): ViewState => {
  const params = new URLSearchParams(search);
  return {
    switches: switchValuesOf(params, switches),
    backdrop: choice(params.get("backdrop"), BACKDROP_CHOICES, DEFAULT_VIEW.backdrop),
    sheets: choice(params.get("sheets"), SHEETS_CHOICES, DEFAULT_VIEW.sheets),
    text: choice(params.get("text"), TEXT_SCALES, DEFAULT_VIEW.text),
    compare: compareAxesOf(params.get("compare"), switches),
    width: stageWidth(params.get("width")),
    height: stageHeight(params.get("height")),
    isPanelOpen: params.get("panel") !== "closed",
    panelTab: choice(params.get("tab"), PANEL_TABS, DEFAULT_VIEW.panelTab),
    zoom: choice(params.get("zoom"), ZOOMS, DEFAULT_VIEW.zoom),
    tools: toolsOf(params.get("tools"))
  };
};

/**
 * The view without any change, for a catalogue's switches.
 *
 * @param switches - the catalogue's switches.
 */
export const defaultView = (switches: readonly ViewSwitch[]): ViewState => parseView("", switches);

/**
 * Whether a switch's value in a view is its default (a switch the view does not hold counts as its default).
 *
 * @param view - the view.
 * @param each - the switch.
 */
const isDefault = (view: Pick<ViewState, "switches">, each: ViewSwitch): boolean =>
  (view.switches[each.id] ?? each.default) === each.default;

/**
 * The parameters a frame's document reads, only what differs from the defaults: the switches in their declared
 * order, then Forgebook's own settings, then the language.
 */
const frameParams = (view: ViewState, switches: readonly ViewSwitch[]): URLSearchParams => {
  const params = new URLSearchParams();
  const language = switchWithRole(switches, "language");
  const setSwitch = (each: ViewSwitch): void => {
    if (!isDefault(view, each)) params.set(each.id, view.switches[each.id] ?? each.default);
  };
  for (const each of switches) if (each !== language) setSwitch(each);
  if (view.backdrop !== DEFAULT_VIEW.backdrop) params.set("backdrop", view.backdrop);
  if (view.sheets !== DEFAULT_VIEW.sheets) params.set("sheets", view.sheets);
  if (view.text !== DEFAULT_VIEW.text) params.set("text", String(view.text));
  if (language !== undefined) setSwitch(language);
  return params;
};

/**
 * The query parameters of a view: only what differs from the defaults.
 *
 * @param view - the view.
 * @param switches - the catalogue's switches.
 * @returns the parameters, in a stable order.
 */
export const viewParams = (view: ViewState, switches: readonly ViewSwitch[]): URLSearchParams => {
  const params = frameParams(view, switches);
  if (isComparing(view)) params.set("compare", view.compare.join(","));
  if (view.width !== DEFAULT_VIEW.width) params.set("width", String(view.width));
  if (view.height !== DEFAULT_VIEW.height) params.set("height", String(view.height));
  if (!view.isPanelOpen) params.set("panel", "closed");
  if (view.panelTab !== DEFAULT_VIEW.panelTab) params.set("tab", view.panelTab);
  if (view.zoom !== DEFAULT_VIEW.zoom) params.set("zoom", String(view.zoom));
  if (view.tools.length > 0) params.set("tools", view.tools.join(","));
  return params;
};

/**
 * Whether one of the View menu's settings is changed (a switch the toolbar does not show itself, the background,
 * the style sheets, the text size): the menu button then shows a dot, so a view is never left changed by mistake.
 *
 * @param view - the view.
 * @param switches - the catalogue's switches.
 */
export const hasViewChanges = (view: ViewState, switches: readonly ViewSwitch[]): boolean =>
  switches.some((each) => isMenuSwitch(each) && !isDefault(view, each)) ||
  view.backdrop !== DEFAULT_VIEW.backdrop ||
  view.sheets !== DEFAULT_VIEW.sheets ||
  view.text !== DEFAULT_VIEW.text;

/**
 * Whether a switch sits in the View menu: every one but the colour scheme and the contrast, which the toolbar shows.
 *
 * @param each - the switch.
 */
export const isMenuSwitch = (each: ViewSwitch): boolean =>
  each.role !== "colorScheme" && each.role !== "contrast";

/**
 * The address of a story's frame.
 *
 * @param frameUrl - the frame page (`frame.html`).
 * @param id - the story's id.
 * @param view - the view; what only the shell reads (compare, the stage's width, the panel) is left out.
 * @param switches - the catalogue's switches.
 */
export const frameAddress = (
  frameUrl: string,
  id: string,
  view: ViewState,
  switches: readonly ViewSwitch[]
): string => {
  const params = frameParams(view, switches);
  params.set("story", id);
  return `${frameUrl}?${params.toString()}`;
};

/**
 * The part of a view a frame applies live.
 *
 * @param view - the view.
 */
export const liveView = (view: ViewState): LiveView => ({
  switches: view.switches,
  backdrop: view.backdrop,
  text: view.text
});

/**
 * The scheme a view draws in: its colour scheme switch's, light when the catalogue has none.
 *
 * @param view - the view's switches.
 * @param switches - the catalogue's switches.
 */
export const schemeOf = (
  view: Pick<ViewState, "switches">,
  switches: readonly ViewSwitch[]
): "light" | "dark" | "system" => {
  const scheme = switchWithRole(switches, "colorScheme");
  if (scheme === undefined) return "light";
  return switchValueOf(scheme, view.switches[scheme.id])?.scheme ?? "light";
};

/**
 * Whether a view draws in the higher contrast: its contrast switch's value says so; never without one.
 *
 * @param view - the view's switches.
 * @param switches - the catalogue's switches.
 */
export const isMoreContrastOf = (
  view: Pick<ViewState, "switches">,
  switches: readonly ViewSwitch[]
): boolean => {
  const contrast = switchWithRole(switches, "contrast");
  if (contrast === undefined) return false;
  return switchValueOf(contrast, view.switches[contrast.id])?.isMore === true;
};

/**
 * The language a view shows: the language switch's value, empty for the stories' own text.
 *
 * @param view - the view's switches.
 * @param switches - the catalogue's switches.
 */
export const languageOf = (view: Pick<ViewState, "switches">, switches: readonly ViewSwitch[]): string => {
  const language = switchWithRole(switches, "language");
  return language === undefined ? "" : (view.switches[language.id] ?? language.default);
};

/**
 * The values of the switches applied by code, by id: what the story reads as `context.globals`.
 *
 * @param view - the view's switches.
 * @param switches - the catalogue's switches.
 */
export const codeGlobalsOf = (
  view: Pick<ViewState, "switches">,
  switches: readonly ViewSwitch[]
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    switches
      .filter((each) => each.apply.kind === "code")
      .map((each) => [each.id, view.switches[each.id] ?? each.default])
  );

/** The parameters only the shell reads: a frame's address leaves them out. */
const SHELL_PARAMETERS = [
  "compare",
  "width",
  "height",
  "panel",
  "tab",
  "zoom",
  "tools",
  "args",
  "matrix",
  "component"
];

/**
 * The address of a story's frame from a catalogue's address query, for a tool that does not know the catalogue's
 * switches (`forgebook-shot`): every parameter but the shell's own is kept as written.
 *
 * @param frameUrl - the frame page (`frame.html`).
 * @param id - the story's id.
 * @param search - the catalogue's query (`theme=dark&lang=it`), with or without `?`.
 */
export const frameAddressOf = (frameUrl: string, id: string, search: string): string => {
  const params = new URLSearchParams(search);
  for (const name of SHELL_PARAMETERS) params.delete(name);
  params.delete("story");
  params.set("story", id);
  return `${frameUrl}?${params.toString()}`;
};
