/**
 * Every text the catalogue's shell shows, in one place: the catalogue is a development tool in English, and keeping
 * its words together keeps them consistent and ready for a translation.
 *
 * @remarks
 * A catalogue may replace any plain text by its name (`strings: { props: "Controls", "tabs.props": "Controls" }` in
 * its configuration): the shell applies the replacements once, before it draws (`configureStrings`), as a translation
 * is set up, so every module keeps reading `STRINGS`. A text that takes values (`allStories(count)`) stays the shell's.
 *
 * @module
 */
import type { SheetsChoice, TextScale } from "../viewState.ts";

/** The shell's texts, as Forgebook writes them; `configureStrings` replaces some before the shell draws. */
// biome-ignore lint/nursery/useExplicitType: the texts' type is their own shape (`ShellStrings`); a written one would repeat every key
const shellStrings = {
  searchPlaceholder: "Search",
  searchLabel: "Search components and stories",
  componentsNav: "Components",
  sidebarWidth: "Sidebar width",
  hideSidebar: "Hide the sidebar",
  showSidebar: "Show the sidebar",
  storiesNav: "Stories",
  allStories: (count: number): string => `All ${count} stories`,
  noMatch: "No component matches",
  aliasPlace: (family: string): string => `in ${family}`,
  aliasHint: (place: string): string => `Lives in ${place}: listed here too`,
  alsoIn: (places: string): string => `also listed in ${places}`,
  related: "Related",
  view: "View",
  viewChanged: "A view setting is changed",
  backdrop: "Background",
  backdropPlain: "Plain",
  sheets: "Styles",
  sheetChoices: { full: "Full", structure: "Structure only", restyled: "Restyled" } satisfies Record<
    SheetsChoice,
    string
  >,
  text: "Text",
  textScale: (scale: TextScale): string => `${scale}%`,
  resetView: "Reset to defaults",
  viewInAddress: "Saved in the address",
  compare: "Compare",
  compareOff: "Off",
  compareText: "Text sizes",
  compareSheets: "Styles",
  compareOf: (labels: readonly string[]): string => labels.join(" × "),
  compareCell: (labels: readonly string[]): string => labels.join(" · "),
  width: "Width",
  widthFill: "Fill",
  widthPx: (width: number): string => `${width}`,
  copyStoryId: "Copy the story's id",
  clearSearch: "Clear the search",
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
  panel: "Panel",
  panelHeight: "Panel height",
  closePanel: "Close the panel",
  tabs: {
    props: "Props",
    events: "Events",
    play: "Interactions",
    parts: "Parts and styling",
    code: "Code",
    a11y: "Accessibility"
  },
  playTitle: "Play function",
  playStatus: { running: "running", passed: "passed", failed: "failed" },
  playTime: (ms: number): string => `${ms} ms`,
  playAgain: "Run again",
  playNoSteps: "The play names no steps: wrap its parts in step(label, run) to see them here.",
  fixedExamples: "This story draws fixed examples: its props are not set from here. Every prop, for reading:",
  allProps: "Props",
  openFrame: "Open in a new tab",
  code: "Code",
  codeFromArgs: "from the args",
  codeRender: "the story's render",
  codeError: "The story's code could not be read",
  copy: "Copy",
  copied: "Copied",
  matrix: "Matrix",
  matrixNone: "—",
  matrixColumns: "Matrix columns",
  a11y: "Accessibility",
  a11yCheck: "Check the story",
  a11yRunning: "Checking…",
  a11yPasses: "passes",
  a11yCount: (count: number): string => `${count} ${count === 1 ? "problem" : "problems"}`,
  a11yNone: "No WCAG 2.2 A or AA rule is broken in the story as it is now.",
  a11yError: "The check could not run",
  a11yNotInCompare: "One story at a time: leave Compare to check it",
  replay: "Replay",
  clockLabel: "Story clock",
  clockPause: "Pause the clock",
  clockResume: "Resume the clock",
  clockRestart: "Restart",
  clockSpeed: "Clock speed",
  clockRate: (rate: number): string => `×${rate}`,
  loadingStory: "Loading the story…",
  apiReference: "API reference",
  apiProp: "Prop",
  apiEvent: "Event",
  apiType: "Type",
  apiSignature: "Signature",
  apiDefault: "Default",
  apiWhat: "What it does",
  showCode: "Show code",
  hideCode: "Hide code",
  openStory: "Open the story",
  examples: "Examples",
  pageError: "The component's page could not be read",
  storyLabel: "Story",
  frameTitle: (component: string, story: string): string => `${component}: ${story}`,
  home: "Home",
  homeEmpty: "No stories yet: a source with story files shows its families here.",
  homeSummary: (components: number, sources: number): string =>
    `${components} ${components === 1 ? "component" : "components"} in ${sources} ${sources === 1 ? "library" : "libraries"}.`,
  homeIntroError: "The library's introduction could not be read",
  recentlyOpened: "Recently opened",
  componentsCount: (count: number): string => `${count} ${count === 1 ? "component" : "components"}`,
  showAll: (count: number): string => `Show all ${count}`,
  showFewer: "Show fewer",
  unknownStory: (id: string): string =>
    `No story "${id}": it may have been renamed. Pick one in the sidebar.`,
  unknownComponent: (id: string): string =>
    `No component "${id}": it may have been renamed. Pick one in the sidebar.`,
  props: "Props",
  propGroups: { choice: "Choices", text: "Text and numbers", toggle: "Toggles" },
  otherProps: "Other props",
  unset: "—",
  unsetDefault: (value: string): string => `— (${value})`,
  defaultIs: "Default:",
  pickColor: (prop: string): string => `${prop}: pick a colour`,
  rangeValue: (prop: string): string => `${prop}: value`,
  setByStory: "Set by the story",
  required: "Required",
  resetArgs: "Reset",
  events: "Events",
  calls: "Calls",
  noCalls: "No call yet",
  clearCalls: "Clear",
  parts: "Parts and styling",
  partCount: (count: number): string => `${count} ${count === 1 ? "part" : "parts"}`,
  partsList: "Parts",
  styleHooks: "Styling attributes",
  testIds: "Test ids",
  noProps: "This page has no props",
  docsLoading: "Reading the component…",
  docsError: "The component could not be read",
  indexProblems: "Some story files could not be placed"
};

/** The shell's texts. */
export type ShellStrings = typeof shellStrings;

/** The shell's texts, as shown. */
export const STRINGS: ShellStrings = shellStrings;

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
  for (const [path, text] of Object.entries(replacements)) replaceText(STRINGS, path.split("."), text);
};
