/**
 * The texts of the shell's parts that load after the first screen, but for the home and the docs pages
 * (`pageStrings.ts`): a component's page, the panel's tabs but Props, the View menu's panel, a pinned control's menu, the embed panel and page,
 * the comparison, the story clock's bar, the plugins' hosts and the note on args a link dropped. They load with the
 * first of those parts, so a first load carries none of them.
 *
 * @remarks
 * Each keeps the plain name it would have in `STRINGS`, so a catalogue replaces it the same way
 * (`strings: { copy: "Copia" }`): the replacements set before the shell drew apply when this module loads
 * (`lateStrings`).
 *
 * @module
 */
import { lateStrings } from "./strings.ts";

/** The later parts' texts, as shown: Forgebook's, with the catalogue's replacements. */
export const LATER_STRINGS = lateStrings({
  audienceError: "This part of the page could not be loaded",
  controlMenu: (label: string): string => `${label} on the toolbar`,
  unpinControl: "Remove from the toolbar",
  hideInView: "Hide in View",
  showInView: "Show in View",
  controlKey: (control: string, key: string | undefined): string =>
    key === undefined ? `${control}: no key` : `${control}: key ${key.toUpperCase()}`,
  changeKey: "Change the key: press it, then the new key; Backspace takes it away",
  pressAKey: "Press a key",
  namedViews: "Views",
  saveView: "Save view…",
  viewName: "View name",
  removeView: (name: string): string => `Remove the view ${name}`,
  resetView: "Reset to defaults",
  viewInAddress: "Saved in the address",
  pinControl: (label: string): string => `Pin ${label} to the toolbar`,
  hideControl: (label: string): string => `Hide ${label} in View`,
  showControl: (label: string): string => `Show ${label}`,
  moveControl: (label: string): string => `Move ${label}`,
  moveControlHint: "Drag, or press the arrow keys",
  controlMoved: (label: string, position: number, count: number): string =>
    `${label}, ${position} of ${count}`,
  pinnedNoRoom: "Pinned: back on the toolbar when there is room",
  resetToolbar: "Reset toolbar",
  wrapToolbar: "Wrap the toolbar onto more lines when it is full",
  hiddenControls: (count: number, pinned: number): string =>
    pinned === 0 ? `${count} hidden` : `${count} hidden · ${pinned} on the toolbar`,
  toolbarInBrowser: "The toolbar is kept in this browser",
  compareCell: (labels: readonly string[]): string => labels.join(" · "),
  embedHint: "Paste the link in a wiki or Notion, the HTML in a page of your own.",
  embedLink: "Link",
  embedCode: "HTML",
  embedFollow: "Follow the story's height",
  embedFollowHint: "Adds a script, which some pages remove: the frame then keeps the height written in it.",
  embedLocal: "This address opens only on this computer: copy it from the published catalogue.",
  embedCopyFailed: "Selected: copy it with your keys",
  embedNoStory: "This address names no story.",
  embedUnknownStory: (id: string): string => `No story "${id}": it may have been renamed.`,
  pluginLoading: "Loading the tab…",
  pluginError: "This tab could not be loaded",
  playTitle: "Play function",
  playTime: (ms: number): string => `${ms} ms`,
  playAgain: "Run again",
  playRun: "Run",
  playOnOpen: "Play stories when they open",
  playOff: "This story has a play function. It has not run: run it, or have stories play when they open.",
  playNoSteps: "The play names no steps: wrap its parts in step(label, run) to see them here.",
  codeFromArgs: "from the args",
  codeRender: "the story's render",
  copy: "Copy",
  a11yCheck: "Check the story",
  a11yRunning: "Checking…",
  a11yNone: "No WCAG 2.2 A or AA rule is broken in the story as it is now.",
  a11yError: "The check could not run",
  a11yNotInCompare: "One story at a time: leave Compare to check it",
  clockLabel: "Story clock",
  clockPause: "Pause the clock",
  clockResume: "Resume the clock",
  clockRestart: "Restart",
  clockSpeed: "Clock speed",
  clockRate: (rate: number): string => `×${rate}`,
  apiReference: "API reference",
  apiProp: "Prop",
  apiEvent: "Event",
  apiSignature: "Signature",
  apiDefault: "Default",
  apiMember: "Member",
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
  backToPlaceNamed: (name: string): string => `Back to its place: ${name}`,
  examples: "Examples",
  pageError: "The component's page could not be read",
  droppedArgs: "The link sets values this story does not take; they were left out:",
  droppedArgReasons: {
    undeclared: "not one of its props",
    type: "not of the prop's type",
    unreadable: "its value could not be read",
    markup: "this framework writes it into HTML, so a link may give only plain text",
    control: "its control refuses it, or could not be loaded"
  },
  removeDroppedArgs: "Remove them from the address",
  events: "Events",
  calls: "Calls",
  noCalls: "No call yet",
  clearCalls: "Clear",
  partsList: "Parts",
  styleHooks: "Styling attributes",
  testIds: "Test ids"
});
