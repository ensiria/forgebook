/**
 * The tabs a story's panel shows: Props, Events and Parts and styling from its component's docs, Code from its file,
 * Accessibility always; a tab the story has nothing for is left out.
 *
 * @module
 */

import type { StoryControlsSetting, StoryFileCode } from "@ensiria/story-format/source";
import type { ReactNode } from "react";

import type { ComponentDocs } from "../componentDocs";
import type { ArgValue, PanelArgs } from "../messages";
import type { NamedValues } from "../namedValues";
import type { PlayTrace } from "../playTrace";
import { A11yTab, a11yHint, type CheckState } from "./A11yTab";
import { CodeTab } from "./CodeTab";
import type { DockTab } from "./Dock";
import { EventsTab } from "./EventsTab";
import { InteractionsTab, interactionsHint } from "./InteractionsTab";
import { PartsTab, styleHooks } from "./PartsTab";
import { PropsTab, type TextArgNote } from "./PropsTab";
import { STRINGS } from "./strings";
import type { EventCall } from "./useFrameMessages";
import type { Loaded } from "./useLoaded";

/** What the tabs are built from. */
export type DockTabsInput = {
  /** The component's docs, as loaded. */
  readonly docs: Loaded<ComponentDocs>;
  /** The story file's code, as loaded. */
  readonly code: Loaded<StoryFileCode>;
  /** The story's export name. */
  readonly exportName: string;
  /** The component's name from the sidebar, for the JSX when the docs have none. */
  readonly componentName: string;
  /** The props the story lets the panel set. */
  readonly controls: StoryControlsSetting;
  /** The values of the moment: the story's args with the panel's over them. */
  readonly values: PanelArgs;
  /** Called with a changed value; `undefined` removes the panel's value. */
  readonly onValueChange: (name: string, value: ArgValue | undefined) => void;
  /** Removes every value the panel set. */
  readonly onReset: () => void;
  /** The values the source names for types the panel cannot write. */
  readonly namedValues: NamedValues | undefined;
  /** The props the story gives a text by its key, by name. */
  readonly textArgs: Readonly<Record<string, TextArgNote>>;
  /** The story's calls, newest first. */
  readonly calls: readonly EventCall[];
  /** Clears the calls. */
  readonly onClearCalls: () => void;
  /** The play function's trace; none for a story without a play (or before it ran). */
  readonly trace: PlayTrace | undefined;
  /** Runs the play again. */
  readonly onPlayAgain: () => void;
  /** The accessibility check. */
  readonly check: CheckState;
  /** Runs it; none when it cannot run. */
  readonly onCheck: (() => void) | undefined;
};

/** A message in place of a tab's content: the docs or the code are loading or could not be read. */
const notice = (text: string, isProblem: boolean): ReactNode => (
  <p
    className={isProblem ? "forgebook-problems" : "forgebook-tab-note"}
    role={isProblem ? "alert" : undefined}
  >
    {text}
  </p>
);

/** The tabs read from the component's docs: Props, Events, Parts and styling. */
const docsTabs = (input: DockTabsInput): DockTab[] => {
  const { docs } = input;
  if (docs.status === "none")
    return input.trace === undefined ? [] : [interactionsTab(input.trace, input.onPlayAgain)];
  if (docs.status === "loading") {
    return [{ id: "props", label: STRINGS.tabs.props, content: notice(STRINGS.docsLoading, false) }];
  }
  if (docs.status === "error") {
    return [
      {
        id: "props",
        label: STRINGS.tabs.props,
        content: notice(`${STRINGS.docsError}: ${docs.message}`, true)
      }
    ];
  }
  const component = docs.value;
  const events = component.props.filter((prop) => prop.kind === "event");
  const tabs: DockTab[] = [];
  if (component.props.some((prop) => prop.kind !== "event")) {
    tabs.push({
      id: "props",
      label: STRINGS.tabs.props,
      content: (
        <PropsTab
          docs={component}
          values={input.values}
          controls={input.controls}
          onValueChange={input.onValueChange}
          onReset={input.onReset}
          namedValues={input.namedValues}
          textArgs={input.textArgs}
        />
      )
    });
  }
  if (events.length > 0) {
    tabs.push({
      id: "events",
      label: STRINGS.tabs.events,
      hint: input.calls.length === 0 ? undefined : String(input.calls.length),
      content: <EventsTab events={events} calls={input.calls} onClearCalls={input.onClearCalls} />
    });
  }
  if (input.trace !== undefined) tabs.push(interactionsTab(input.trace, input.onPlayAgain));
  if (component.parts.length > 0 || styleHooks(component).length > 0) {
    tabs.push({
      id: "parts",
      label: STRINGS.tabs.parts,
      hint: component.parts.length === 0 ? undefined : STRINGS.partCount(component.parts.length),
      content: <PartsTab docs={component} />
    });
  }
  return tabs;
};

/** The Interactions tab of a story whose play ran. */
const interactionsTab = (trace: PlayTrace, onPlayAgain: () => void): DockTab => ({
  id: "play",
  label: STRINGS.tabs.play,
  hint: interactionsHint(trace),
  content: <InteractionsTab trace={trace} onPlayAgain={onPlayAgain} />
});

/** The Code tab, when the story file's code is loaded or failed to load. */
const codeTabs = (input: DockTabsInput): DockTab[] => {
  const { code, docs } = input;
  // without the file's code, a story with a render would show the JSX of its args, which is not what it draws
  if (code.status === "loading" || code.status === "none") return [];
  if (code.status === "error") {
    return [
      { id: "code", label: STRINGS.tabs.code, content: notice(`${STRINGS.codeError}: ${code.message}`, true) }
    ];
  }
  return [
    {
      id: "code",
      label: STRINGS.tabs.code,
      content: (
        <CodeTab
          code={code.value}
          exportName={input.exportName}
          componentName={docs.status === "ready" ? docs.value.name : input.componentName}
          args={input.values}
        />
      )
    }
  ];
};

/**
 * The tabs of a story's panel, in order.
 *
 * @param input - the docs, the code, the values, the calls, the check and their setters.
 */
export const dockTabs = (input: DockTabsInput): DockTab[] => [
  ...docsTabs(input),
  ...codeTabs(input),
  {
    id: "a11y",
    label: STRINGS.tabs.a11y,
    hint: a11yHint(input.check),
    content: <A11yTab check={input.check} onCheck={input.onCheck} />
  }
];
