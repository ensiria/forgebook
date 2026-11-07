/**
 * The texts of the catalogue's shell: the catalogue is a development tool in English, and keeping its words together
 * keeps them consistent and ready for a translation.
 *
 * @remarks
 * `STRINGS` holds the texts of what a first load draws; the texts of the parts that load later live beside it and
 * load with those parts, so a first load carries none of them: the home and the docs pages (`pageStrings.ts`),
 * the other pages, tabs and panels opened on demand (`laterStrings.ts`), the search's results (`searchStrings.ts`),
 * the audiences' sections (`audiencePage.ts`). A
 * catalogue may replace any plain text by its name (`strings: { props: "Controls", "tabs.props": "Controls" }` in
 * its configuration), wherever the text lives: the shell applies the replacements once, before it draws
 * (`configureStrings`), as a translation is set up, and the later texts take them when they load
 * (`lateStrings`, `textsOfGroup`). A text that takes values (`allStories(count)`) stays the shell's.
 *
 * @module
 */
import type { SheetsChoice, TextScale } from "../viewState.ts";

/** The shell's texts, as Forgebook writes them; `configureStrings` replaces some before the shell draws. */
// biome-ignore lint/nursery/useExplicitType: the texts' type is their own shape (`ShellStrings`); a written one would repeat every key
const shellStrings = {
  searchPlaceholder: "Search",
  searchLabel: "Search components, stories, props and docs",
  componentsNav: "Components",
  docsNav: "Docs",
  sidebarWidth: "Sidebar width",
  hideSidebar: "Hide the sidebar",
  showSidebar: "Show the sidebar",
  storiesNav: "Stories",
  allStories: (count: number): string => `All ${count} stories`,
  noMatch: "No name matches",
  aliasPlace: (family: string): string => `in ${family}`,
  aliasHint: (place: string): string => `Lives in ${place}: listed here too`,
  alsoIn: (places: string): string => `also listed in ${places}`,
  related: "Related",
  view: "View",
  viewChanged: "A view setting is changed",
  viewMenuError: "The View menu could not be loaded",
  compareError: "The comparison could not be loaded",
  controlChanged: (control: string): string => `${control}: changed`,
  cycleKey: (control: string, key: string): string =>
    `${control}: press ${key} for the next value, Shift+${key} for the one before`,
  aboutControl: (control: string): string => `About ${control}`,
  backdrop: "Background",
  backdropPlain: "Plain",
  sheets: "Styles",
  sheetChoices: { full: "Full", structure: "Structure only", restyled: "Restyled" } satisfies Record<
    SheetsChoice,
    string
  >,
  text: "Text",
  textScale: (scale: TextScale): string => `${scale}%`,
  compare: "Compare",
  compareOff: "Off",
  compareText: "Text sizes",
  compareSheets: "Styles",
  compareOf: (labels: readonly string[]): string => labels.join(" × "),
  width: "Width",
  widthFill: "Fill",
  widthPx: (width: number): string => `${width}`,
  copyStoryId: "Copy the story's id",
  embedStory: "Embed this story",
  embedFailed: "This story could not be shown.",
  embedPanelFailed: "This could not load: reload the page to try again.",
  clearSearch: "Clear the search",
  keys: "Keyboard keys",
  fromTexts: "From the story's texts:",
  backToText: "Back to the text",
  widthTyped: "Width in px",
  widthAuto: "auto",
  zoom: "Zoom",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  zoomReset: "Back to 100%",
  stageTools: "Zoom and measuring tools",
  tools: {
    outline: "Outline every element",
    grid: "8 px grid",
    measure: "Measure the element under the pointer"
  },
  widthHandle: "Story width",
  widthHandleHint: "Drag to resize the story; double-click for the whole stage",
  heightHandle: "Story height",
  heightHandleHint: "Drag to change the story's height; double-click for its own",
  widthFillNote: "Fill: the story takes the whole stage",
  device: "Device",
  deviceNone: "No frame",
  devicePhones: "Phones",
  deviceGeneric: "Generic phone",
  deviceTablets: "Tablets",
  deviceTurn: "Turn the device",
  setByDevice: "Set by the device frame",
  panel: "Panel",
  panelHeight: "Panel height",
  closePanel: "Close the panel",
  tabs: {
    props: "Props",
    events: "Events",
    play: "Interactions",
    parts: "Parts and styling",
    code: "Code",
    a11y: "Accessibility",
    signature: "Signature"
  },
  openInFigma: "Open in Figma",
  logic: "Logic",
  logicHint: "About logic, not looks: a scene that uses the hook or the function",
  signatureParameter: "Parameter",
  signatureReturns: "Returns",
  signatureNone: "It takes no parameters.",
  playStatus: { running: "running", passed: "passed", failed: "failed", off: "not run" },
  fixedExamples: "This story draws fixed examples: its props are not set from here. Every prop, for reading:",
  allProps: "Props",
  openFrame: "Open in a new tab",
  code: "Code",
  codeLoading: "Reading the story's code…",
  codeError: "The story's code could not be read",
  copied: "Copied",
  matrix: "Matrix",
  matrixNone: "—",
  matrixColumns: "Matrix columns",
  a11y: "Accessibility",
  a11yPasses: "passes",
  a11yCount: (count: number): string => `${count} ${count === 1 ? "problem" : "problems"}`,
  replay: "Replay",
  loadingStory: "Loading the story…",
  apiType: "Type",
  apiWhat: "What it does",
  propCount: (count: number): string => `${count} ${count === 1 ? "prop" : "props"}`,
  audience: "Reading for",
  audiences: { everyone: "Everyone", designer: "Designers", coder: "Coders", tester: "Testers" },
  audienceElsewhere: "Changes a component's page",
  storyLabel: "Story",
  frameTitle: (component: string, story: string): string => `${component}: ${story}`,
  home: "Home",
  unknownStory: (id: string): string =>
    `No story "${id}": it may have been renamed. Pick one in the sidebar.`,
  unknownPage: (id: string): string => `No page "${id}": it may have been renamed. Pick one in the sidebar.`,
  unknownComponent: (id: string): string =>
    `No component "${id}": it may have been renamed. Pick one in the sidebar.`,
  props: "Props",
  otherProps: "Other props",
  unset: "—",
  unsetProp: (prop: string): string => `${prop}: leave without a value`,
  resetProp: (prop: string): string => `${prop}: back to the story's value`,
  stateUnset: "no value",
  stateEmpty: "empty text",
  unsetDefault: (value: string): string => `— (${value})`,
  defaultIs: "Default:",
  pickColor: (prop: string): string => `${prop}: pick a colour`,
  rangeValue: (prop: string): string => `${prop}: value`,
  setByStory: "Set by the story",
  setBy: "Set by {value}",
  required: "Required",
  requiredFirst: "Required first",
  requiredFirstHint: "Every component's required props before the others; kept in this browser",
  resetArgs: "Reset",
  // not "Appearance": a catalogue's own switch may bear that name, and this one colours the catalogue, never the story
  appearance: "Interface",
  appearanceOf: (name: string): string => `${STRINGS.appearance}: ${name}`,
  appearances: { light: "Light", dark: "Dark", system: "System", story: "Follow the story" },
  worstCase: "Worst case",
  worstCaseHint:
    "Long texts with a word too long to break, huge numbers: the elements that spill are outlined",
  spills: (count: number): string => {
    if (count === 0) return "Nothing spills";
    return count === 1 ? "1 element spills" : `${count} elements spill`;
  },
  parts: "Parts and styling",
  partCount: (count: number): string => `${count} ${count === 1 ? "part" : "parts"}`,
  noProps: "This page has no props",
  docsLoading: "Reading the component…",
  tabLoading: "Loading the tab…",
  tabError: "The tab could not be loaded",
  pageLoadError: "The page could not be loaded",
  docsError: "The component could not be read",
  indexProblems: "Some story files could not be read or placed"
};

/** The shell's texts. */
export type ShellStrings = typeof shellStrings;

/** The shell's texts, as shown. */
export const STRINGS: ShellStrings = shellStrings;

/** The catalogue's replacements, for the texts that load after it set them. */
let catalogueReplacements: Readonly<Record<string, string>> = {};

/**
 * Whether a value is a group of texts (`tabs`), whose members a path can name.
 *
 * @param value - a value among the texts.
 */
const isTextGroup = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Replaces one text, by its path among the shell's texts (`props`, `tabs.props`): only a plain text, never a text
 * that takes values, and nothing for a path that names none.
 *
 * @param texts - the texts, or a group of them.
 * @param path - the text's name, then its name within each group.
 * @param text - the new text.
 */
const replaceText = (texts: Record<string, unknown>, path: readonly string[], text: string): void => {
  const [name, ...rest] = path;
  if (name === undefined) return;
  const current = texts[name];
  if (rest.length === 0) {
    if (typeof current === "string") texts[name] = text;
    return;
  }
  if (isTextGroup(current)) replaceText(current, rest, text);
};

/**
 * Applies a catalogue's replacements to the shell's texts, once, before the shell draws.
 *
 * @param replacements - the new texts, by their path (`tabs.props`).
 */
export const configureStrings = (replacements: Readonly<Record<string, string>>): void => {
  catalogueReplacements = replacements;
  for (const [path, text] of Object.entries(replacements)) replaceText(STRINGS, path.split("."), text);
};

/**
 * The texts of a part of the shell loaded on first use (the docs pages), with the catalogue's replacements applied as
 * they load: they live with their part, so the first load does not carry them, and keep their names among the shell's
 * texts, so a catalogue replaces them as any other.
 *
 * @param texts - the part's texts, as Forgebook writes them.
 * @returns the same texts, replaced where the catalogue asks.
 */
export const lateStrings = <TTexts extends Record<string, unknown>>(texts: TTexts): TTexts => {
  for (const [path, text] of Object.entries(catalogueReplacements)) replaceText(texts, path.split("."), text);
  return texts;
};

/**
 * Texts kept out of the first load, with the catalogue's replacements applied as those of `STRINGS` are.
 *
 * @param group - their name among the texts (`audienceTexts`): a replacement's path starts with it.
 * @param texts - the texts.
 * @returns the same texts, changed in place.
 */
export const textsOfGroup = <TTexts extends Record<string, unknown>>(
  group: string,
  texts: TTexts
): TTexts => {
  lateStrings({ [group]: texts });
  return texts;
};
