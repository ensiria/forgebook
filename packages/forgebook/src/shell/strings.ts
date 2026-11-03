/**
 * Every text the catalogue's shell shows, in one place: the catalogue is a development tool in English, and keeping
 * its words together keeps them consistent and ready for a translation.
 *
 * @remarks
 * Only the audiences' texts (`audiencePage.ts`) live elsewhere, to stay out of the first load. A catalogue may replace any plain text by its name (`strings: { props: "Controls", "tabs.props": "Controls" }` in
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
  searchLabel: "Search components, stories and docs",
  componentsNav: "Components",
  docsNav: "Docs",
  pageContents: "On this page",
  previousPage: "Previous",
  nextPage: "Next",
  docPageError: "The page could not be read",
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
  viewMenuError: "The View menu could not be loaded",
  audienceError: "This part of the page could not be loaded",
  controlChanged: (control: string): string => `${control}: changed`,
  controlKey: (control: string, key: string | undefined): string =>
    key === undefined ? `${control}: no key` : `${control}: key ${key.toUpperCase()}`,
  cycleKey: (control: string, key: string): string =>
    `${control}: press ${key} for the next value, Shift+${key} for the one before`,
  changeKey: "Change the key: press it, then the new key; Backspace takes it away",
  pressAKey: "Press a key",
  aboutControl: (control: string): string => `About ${control}`,
  namedViews: "Views",
  saveView: "Save view…",
  viewName: "View name",
  removeView: (name: string): string => `Remove the view ${name}`,
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
  pinControl: (label: string): string => `Pin ${label} to the toolbar`,
  hideControl: (label: string): string => `Hide ${label} in View`,
  showControl: (label: string): string => `Show ${label}`,
  moveControl: (label: string): string => `Move ${label}`,
  moveControlHint: "Drag, or press the arrow keys",
  controlMoved: (label: string, position: number, count: number): string =>
    `${label}, ${position} of ${count}`,
  controlMenu: (label: string): string => `${label} on the toolbar`,
  unpinControl: "Remove from the toolbar",
  hideInView: "Hide in View",
  showInView: "Show in View",
  pinnedNoRoom: "Pinned: back on the toolbar when there is room",
  resetToolbar: "Reset toolbar",
  wrapToolbar: "Wrap the toolbar onto more lines when it is full",
  hiddenControls: (count: number, pinned: number): string =>
    pinned === 0 ? `${count} hidden` : `${count} hidden · ${pinned} on the toolbar`,
  toolbarInBrowser: "The toolbar is kept in this browser",
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
  embedStory: "Embed this story",
  embedHint: "Paste the link in a wiki or Notion, the HTML in a page of your own.",
  embedLink: "Link",
  embedCode: "HTML",
  embedFollow: "Follow the story's height",
  embedFollowHint: "Adds a script, which some pages remove: the frame then keeps the height written in it.",
  embedLocal: "This address opens only on this computer: copy it from the published catalogue.",
  embedFailed: "This story could not be shown.",
  embedPanelFailed: "This could not load: reload the page to try again.",
  embedCopyFailed: "Selected: copy it with your keys",
  embedNoStory: "This address names no story.",
  embedUnknownStory: (id: string): string => `No story "${id}": it may have been renamed.`,
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
    a11y: "Accessibility",
    signature: "Signature"
  },
  openInFigma: "Open in Figma",
  pluginLoading: "Loading the tab…",
  pluginError: "This tab could not be loaded",
  logic: "Logic",
  logicHint: "About logic, not looks: a scene that uses the hook or the function",
  signatureParameter: "Parameter",
  signatureReturns: "Returns",
  signatureNone: "It takes no parameters.",
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
  codeLoading: "Reading the story's code…",
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
  apiMember: "Member",
  propCount: (count: number): string => `${count} ${count === 1 ? "prop" : "props"}`,
  memberCount: (count: number): string => `${count} ${count === 1 ? "member" : "members"}`,
  membersOf: (type: string): string => `Members of ${type}`,
  showCode: "Show code",
  hideCode: "Hide code",
  openStory: "Open the story",
  usedIn: "Used in",
  usedInThrough: "through another component",
  usedInMore: (count: number): string => `and ${count} more`,
  usedInStories: (count: number): string => (count === 1 ? "1 story" : `${count} stories`),
  openStoryNamed: (name: string): string => `Open the story ${name}`,
  touch: "Touch",
  touchNamed: (name: string): string => `Touch ${name} with a finger`,
  fillPage: "Fill the page",
  fillPageNamed: (name: string): string => `Fill the page with ${name}`,
  backToPlace: "Back to its place",
  backToPlaceNamed: (name: string): string => `Put ${name} back in its place`,
  examples: "Examples",
  audience: "Reading for",
  audiences: { everyone: "Everyone", designer: "Designers", coder: "Coders", tester: "Testers" },
  audienceElsewhere: "Changes a component's page",
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
  unknownPage: (id: string): string => `No page "${id}": it may have been renamed. Pick one in the sidebar.`,
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
  droppedArgs: "The link sets values this story does not take; they were left out:",
  droppedArgReasons: { undeclared: "not one of its props", type: "not of the prop's type" },
  removeDroppedArgs: "Remove them from the address",
  appearance: "Appearance",
  appearanceOf: (name: string): string => `Appearance: ${name}`,
  appearances: { light: "Light", dark: "Dark", system: "System", story: "Follow the story" },
  worstCase: "Worst case",
  worstCaseHint:
    "Long texts with a word too long to break, huge numbers: the elements that spill are outlined",
  spills: (count: number): string => {
    if (count === 0) return "Nothing spills";
    return count === 1 ? "1 element spills" : `${count} elements spill`;
  },
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
  tabLoading: "Loading the tab…",
  tabError: "The tab could not be loaded",
  pageLoadError: "The page could not be loaded",
  docsError: "The component could not be read",
  indexProblems: "Some story files could not be placed"
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
  for (const [path, text] of Object.entries(catalogueReplacements)) {
    replaceText({ [group]: texts }, path.split("."), text);
  }
  return texts;
};
