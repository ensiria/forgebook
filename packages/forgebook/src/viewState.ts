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

import type { CatalogueSettings, OwnControlId } from "./catalogue.ts";
import { switchValueOf, switchWithRole, type TouchChoice, type ViewSwitch } from "./switches.ts";

/**
 * What Forgebook draws behind the story, in place of its page's colour: `plain`, the page's colour itself,
 * or the id of one of the catalogue's backdrops (`backdrops.ts`). Forgebook draws them itself, never the library it
 * shows.
 */
export type BackdropChoice = string;

/** The page's own colour: no backdrop drawn. */
export const PLAIN_BACKDROP = "plain";

/** Which style sheets the frame loads besides the required ones. */
export type SheetsChoice = "full" | "structure" | "restyled";

/** The root font size, in percent of the browser's (one of the catalogue's text sizes): lengths in rem follow it. */
export type TextScale = number;

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
export type Zoom = number;

/** A tab of the panel under a story. */
export type PanelTab = string;

/** The story's width on the stage: the stage's whole width, or a width in CSS px (a preset, or dragged). */
export type StageWidth = "fill" | number;

/**
 * The story's height on the stage: its own (`auto`: the story's content, at least the height it declares) or a
 * height in CSS px dragged with the handle at its foot.
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

/** Every style sheet setting, in the menu's order. */
export const SHEETS_CHOICES: readonly SheetsChoice[] = ["full", "structure", "restyled"];

/**
 * Whether the stage compares the story across a switch's values.
 *
 * @param view - the view.
 */
export const isComparing = (view: ViewState): boolean => view.compare.length > 0;

/** Every tool, in the bar's order. */
export const MEASURE_TOOLS: readonly MeasureTool[] = ["outline", "grid", "measure"];

/** The tools a parameter names (`outline,measure`), in their order; unknown names are left out. */
const toolsOf = (value: string | null): MeasureTool[] => {
  const names = (value ?? "").split(",");
  return MEASURE_TOOLS.filter((tool) => names.includes(tool));
};

/** What the view reads of a catalogue: its switches and the lists its values are checked against. */
export type ViewCatalogue = Pick<
  CatalogueSettings,
  "switches" | "widthRange" | "zooms" | "textSizes" | "backdrops" | "tabs" | "ownControls"
>;

/**
 * A width kept in a catalogue's range, in whole pixels.
 *
 * @param width - a width in CSS px.
 * @param range - the narrowest and widest a story may be set.
 */
export const clampedWidth = (width: number, range: ViewCatalogue["widthRange"]): number =>
  Math.round(Math.min(range.max, Math.max(range.min, width)));

/** The width a parameter names: a whole number of px in the range, otherwise the stage's whole width. */
const stageWidth = (value: string | null, range: ViewCatalogue["widthRange"]): StageWidth => {
  const width = Number(value);
  return value !== null && Number.isInteger(width) && clampedWidth(width, range) === width ? width : "fill";
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
const compareAxesOf = (value: string | null, catalogue: ViewCatalogue): CompareAxes => {
  const { switches, ownControls } = catalogue;
  if (value === null || value === "") return [];
  const scheme = switchWithRole(switches, "colorScheme");
  const contrast = switchWithRole(switches, "contrast");
  const legacy: Readonly<Record<string, readonly (string | undefined)[]>> = {
    "1": [scheme?.id, contrast?.id],
    theme: [scheme?.id, contrast?.id],
    language: [switchWithRole(switches, "language")?.id]
  };
  const named = legacy[value] ?? value.split(",");
  const known = [
    ...switches.map((each) => each.id),
    ...OWN_COMPARE_AXES.filter((axis) => ownControls.includes(axis))
  ];
  return named.filter((axis): axis is string => axis !== undefined && known.includes(axis)).slice(0, 2);
};

/**
 * The view a URL's query describes.
 *
 * @param search - the query (`?theme=dark&motion=reduced`), with or without `?`.
 * @param catalogue - the catalogue's switches and lists.
 */
export const parseView = (search: string, catalogue: ViewCatalogue): ViewState => {
  const params = new URLSearchParams(search);
  // a control the catalogue turned off keeps its default, whatever the address says
  const shown = (control: OwnControlId): string | null =>
    catalogue.ownControls.includes(control) ? params.get(control) : null;
  return {
    switches: switchValuesOf(params, catalogue.switches),
    backdrop: choice(
      shown("backdrop"),
      catalogue.backdrops.map((backdrop) => backdrop.id),
      DEFAULT_VIEW.backdrop
    ),
    sheets: choice(shown("sheets"), SHEETS_CHOICES, DEFAULT_VIEW.sheets),
    text: choice(shown("text"), catalogue.textSizes, DEFAULT_VIEW.text),
    compare: compareAxesOf(params.get("compare"), catalogue),
    width: stageWidth(params.get("width"), catalogue.widthRange),
    height: stageHeight(params.get("height")),
    isPanelOpen: params.get("panel") !== "closed",
    panelTab: choice(params.get("tab"), catalogue.tabs, catalogue.tabs[0] ?? DEFAULT_VIEW.panelTab),
    zoom: choice(params.get("zoom"), catalogue.zooms, DEFAULT_VIEW.zoom),
    tools: toolsOf(params.get("tools"))
  };
};

/**
 * The view without any change, for a catalogue.
 *
 * @param catalogue - the catalogue's switches and lists.
 */
export const defaultView = (catalogue: ViewCatalogue): ViewState => parseView("", catalogue);

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
 * Whether one of the given controls' values is changed (a switch, the background, the style sheets, the text size;
 * the stage's width is not a view setting): the View menu's button shows a dot for the controls it holds, so a view
 * is never left changed by mistake, even by a control the person hid.
 *
 * @param view - the view.
 * @param switches - the catalogue's switches.
 * @param ids - the controls' ids.
 */
export const hasViewChanges = (
  view: ViewState,
  switches: readonly ViewSwitch[],
  ids: readonly string[]
): boolean =>
  switches.some((each) => ids.includes(each.id) && !isDefault(view, each)) ||
  (ids.includes("backdrop") && view.backdrop !== DEFAULT_VIEW.backdrop) ||
  (ids.includes("sheets") && view.sheets !== DEFAULT_VIEW.sheets) ||
  (ids.includes("text") && view.text !== DEFAULT_VIEW.text);

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
 * Whether a view simulates a finger.
 *
 * @param view - the view's switches.
 * @param choice - the touch switch.
 */
export const isTouchView = (view: Pick<ViewState, "switches">, choice: TouchChoice): boolean =>
  view.switches[choice.id] === choice.touch;

/**
 * A view with a finger simulated or not; the same view when it already is.
 *
 * @param view - the view.
 * @param choice - the touch switch.
 * @param isTouch - whether it simulates a finger.
 */
export const withTouch = <View extends Pick<ViewState, "switches">>(
  view: View,
  choice: TouchChoice,
  isTouch: boolean
): View =>
  isTouchView(view, choice) === isTouch
    ? view
    : { ...view, switches: { ...view.switches, [choice.id]: isTouch ? choice.touch : choice.mouse } };

/**
 * A view with the touch switch as another view has it: what a story's own touch leaves of the address.
 *
 * @param view - the view.
 * @param from - the view whose touch value it takes.
 * @param choice - the touch switch.
 */
export const withTouchOf = <View extends Pick<ViewState, "switches">>(
  view: View,
  from: Pick<ViewState, "switches">,
  choice: TouchChoice
): View => {
  const value = from.switches[choice.id];
  if (view.switches[choice.id] === value) return view;
  const { [choice.id]: _replaced, ...others } = view.switches;
  return { ...view, switches: value === undefined ? others : { ...others, [choice.id]: value } };
};

/**
 * The values of the switches applied by code, by id, and the touch switch's: what the story reads as
 * `context.globals`. A story reads the touch switch's value (`mouse` or `touch`) to draw only the version that fits
 * it: a row's swipe actions for a finger, its menu button for a mouse.
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
      .filter((each) => each.apply.kind === "code" || each.role === "touch")
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

/**
 * The address of a story's page in the catalogue from a catalogue's address query, for a tool that does not know the
 * catalogue's switches: the story selected, the view kept as written.
 *
 * @param pageUrl - the catalogue's page (`http://localhost:5173/`).
 * @param id - the story's id.
 * @param search - the view's query (`theme=dark&lang=it`), with or without `?`.
 */
export const storyAddressOf = (pageUrl: string, id: string, search: string): string => {
  const params = new URLSearchParams(search);
  params.delete("component");
  params.delete("story");
  params.set("story", id);
  return `${pageUrl}?${params.toString()}`;
};
