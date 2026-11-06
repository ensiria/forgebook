/**
 * The tabs a story's panel shows: Props, Events and Parts and styling from its component's docs, Code from its file,
 * the plugins', Accessibility always; a tab the story has nothing for is left out. A story about logic opens on its hook's
 * Signature and shows no tab of args (`logicTabs`).
 *
 * @remarks
 * The dock draws only the chosen tab's content, and most stories open on Props: the other tabs' modules (Events,
 * Interactions, Parts and styling, Code, Accessibility) load the first time each is chosen (`lazyModule.tsx`), and a
 * plugin's the first time it is shown, so a first load fetches none of them. What the row of tabs shows of them (a hint, whether there is one) is in `tabSummaries`.
 *
 * @module
 */

import type { StoryControlsSetting, StoryFileCode } from "@forgebook/story-format/source";
import type { ReactNode } from "react";

import { isArgShown } from "../argConditions.ts";
import { type PanelArgTypes, type PanelProp, panelProps } from "../argTypes.ts";
import { type ComponentDocs, codeNameOf, type PropDocs } from "../componentDocs.ts";
import type { ArgValue, PanelArgs } from "../messages.ts";
import type { NamedValues } from "../namedValues.ts";
import type { PlayTrace } from "../playTrace.ts";
import type { TreeStory } from "../storyTree.ts";
import type { CheckState } from "./A11yTab.tsx";
import type { DockTab } from "./Dock.tsx";
import { lazyModule } from "./lazyModule.tsx";
import { LazyTab } from "./lazyTab.tsx";
import type { TextArgNote } from "./PropRows.tsx";
import { PropsTab } from "./PropsTab.tsx";
import { SignatureReference } from "./SignatureReference.tsx";
import { STRINGS } from "./strings.ts";
import { a11yHint, interactionsHint, styleHooks } from "./tabSummaries.ts";
import type { EventCall } from "./useFrameMessages.ts";
import type { Loaded } from "./useLoaded.ts";
import type { WorstCaseState } from "./worstArgs.ts";

/** The Events tab, its module, loaded when the tab is first chosen. */
const EVENTS_TAB = lazyModule(() => import("./EventsTab.tsx").then((module) => module.EventsTab));

/** The Interactions tab, its module, loaded when the tab is first chosen. */
const INTERACTIONS_TAB = lazyModule(() =>
  import("./InteractionsTab.tsx").then((module) => module.InteractionsTab)
);

/** The Parts and styling tab, its module, loaded when the tab is first chosen. */
const PARTS_TAB = lazyModule(() => import("./PartsTab.tsx").then((module) => module.PartsTab));

/** The Code tab, its module, loaded when the tab is first chosen. */
const CODE_TAB = lazyModule(() => import("./CodeTab.tsx").then((module) => module.CodeTab));

/** The Accessibility tab, its module, loaded when the tab is first chosen. */
const A11Y_TAB = lazyModule(() => import("./A11yTab.tsx").then((module) => module.A11yTab));

/** What the tabs are built from. */
export type DockTabsInput = {
  /** The component's docs, as loaded. */
  readonly docs: Loaded<ComponentDocs>;
  /** The story file's code, as loaded. */
  readonly code: Loaded<StoryFileCode>;
  /**
   * The story: its export name, whether it is about logic (its hook's signature comes first), and where it puts the
   * required props (none for the catalogue's).
   */
  readonly story: Pick<TreeStory, "exportName" | "isLogic" | "requiredFirst">;
  /** The component's name from the sidebar, for the JSX when the docs have none. */
  readonly componentName: string;
  /** The props the story lets the panel set. */
  readonly controls: StoryControlsSetting;
  /** The story's `argTypes`, as its frame reported them; none before it is ready. */
  readonly argTypes: PanelArgTypes;
  /** The args the story's frame records as actions (a spy, an `argTypes` action); none before it is ready. */
  readonly actions: readonly string[];
  /** The values of the moment: the story's args with the panel's over them. */
  readonly values: PanelArgs;
  /** The panel's own values, for what can go back to the story's. */
  readonly panelArgs: PanelArgs;
  /** The story's own args, for a control no type describes. */
  readonly storyArgs: PanelArgs;
  /** Loads the catalogue's design tokens; none when it has none. */
  readonly loadTokens: (() => Promise<unknown>) | undefined;
  /** The switches' values of the moment, for the args whose `argTypes.if` reads a global. */
  readonly globals: Readonly<Record<string, unknown>>;
  /** Called with a changed value; `undefined` removes the panel's value. */
  readonly onValueChange: (name: string, value: ArgValue | undefined) => void;
  /** Removes every value the panel set. */
  readonly onReset: () => void;
  /** The worst case: whether it can be set, whether it is on, and the spills the frame counts. */
  readonly worstCase: WorstCaseState;
  /** The values the source names for types the panel cannot write. */
  readonly namedValues: NamedValues | undefined;
  /** The props the story gives a text by its key, by name. */
  readonly textArgs: Readonly<Record<string, TextArgNote>>;
  /** The prop groups the component's meta lists first, in order (`parameters.propGroups`); empty when none. */
  readonly propGroups: readonly string[];
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
  /** The plugins' tabs the story has something for. */
  readonly pluginTabs: readonly DockTab[];
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

/**
 * The Props tab, when the story has a prop to show.
 *
 * @param input - what the tabs are built from.
 * @param props - the props, from the types with the `argTypes` laid over them.
 */
const propsTab = (input: DockTabsInput, all: readonly PanelProp[]): DockTab[] => {
  // the condition is the moment's, so it is tested here and not where the props are declared: a value set while an arg
  // is hidden, from the address or the story, is still the story's
  const props = all.filter((prop) => isArgShown(input.argTypes[prop.name]?.if, input.values, input.globals));
  return props.some((prop) => prop.kind !== "event")
    ? [
        {
          id: "props",
          label: STRINGS.tabs.props,
          content: (
            <PropsTab
              props={props}
              values={input.values}
              panelArgs={input.panelArgs}
              loadTokens={input.loadTokens}
              controls={input.controls}
              onValueChange={input.onValueChange}
              onReset={input.onReset}
              worstCase={input.worstCase}
              namedValues={input.namedValues}
              textArgs={input.textArgs}
              componentGroups={input.propGroups}
              requiredFirst={input.story.requiredFirst}
            />
          )
        }
      ]
    : [];
};

/**
 * The events the Events tab lists: the component's, then the story's actions its types do not name.
 *
 * @param props - the component's props; none for a story without one.
 * @param actions - the story's actions.
 */
const eventsOf = (props: readonly PropDocs[], actions: readonly string[]): readonly PropDocs[] => {
  const events = props.filter((prop) => prop.kind === "event");
  const named = new Set(events.map((event) => event.name));
  return [
    ...events,
    ...actions
      .filter((name) => !named.has(name))
      .map((name): PropDocs => ({ name, kind: "event", type: "", description: "", isRequired: false }))
  ];
};

/**
 * The Events tab, when the story has an event or an action, or made a call a framework reports (a router's `push`).
 *
 * @param input - what the tabs are built from.
 * @param events - the events and actions.
 */
const eventsTab = (input: DockTabsInput, events: readonly PropDocs[]): DockTab[] =>
  events.length === 0 && input.calls.length === 0
    ? []
    : [
        {
          id: "events",
          label: STRINGS.tabs.events,
          hint: input.calls.length === 0 ? undefined : String(input.calls.length),
          content: (
            <LazyTab
              module={EVENTS_TAB}
              tabProps={{ events, calls: input.calls, onClearCalls: input.onClearCalls }}
            />
          )
        }
      ];

/** The tabs read from the component's docs: Props, Events, Parts and styling. */
const docsTabs = (input: DockTabsInput): DockTab[] => {
  const { docs } = input;
  // a story without a component (a render of its own) still has the args its `argTypes` name
  if (docs.status === "none") {
    return [
      ...propsTab(input, panelProps([], input.argTypes, input.storyArgs)),
      ...eventsTab(input, eventsOf([], input.actions)),
      ...(input.trace === undefined ? [] : [interactionsTab(input.trace, input.onPlayAgain)])
    ];
  }
  // the docs' place while they load or fail: the tab the story opens on once they are read
  const docsTab: Pick<DockTab, "id" | "label"> = input.story.isLogic
    ? { id: "signature", label: STRINGS.tabs.signature }
    : { id: "props", label: STRINGS.tabs.props };
  // the play's trace comes from the frame, not from the docs: a first read of a project's docs can take seconds, and a
  // play that finished meanwhile is shown without waiting for them, or when they fail
  const played = input.trace === undefined ? [] : [interactionsTab(input.trace, input.onPlayAgain)];
  if (docs.status === "loading")
    return [{ ...docsTab, content: notice(STRINGS.docsLoading, false) }, ...played];
  if (docs.status === "error") {
    return [{ ...docsTab, content: notice(`${STRINGS.docsError}: ${docs.message}`, true) }, ...played];
  }
  const component = docs.value;
  const events = eventsOf(component.props, input.actions);
  if (input.story.isLogic) return logicTabs(input, component);
  const tabs: DockTab[] = [];
  tabs.push(...propsTab(input, panelProps(component.props, input.argTypes, input.storyArgs)));
  tabs.push(...eventsTab(input, events));
  if (input.trace !== undefined) tabs.push(interactionsTab(input.trace, input.onPlayAgain));
  if (component.parts.length > 0 || styleHooks(component).length > 0) {
    tabs.push({
      id: "parts",
      label: STRINGS.tabs.parts,
      hint: component.parts.length === 0 ? undefined : STRINGS.partCount(component.parts.length),
      content: <LazyTab module={PARTS_TAB} tabProps={{ docs: component }} />
    });
  }
  return tabs;
};

/**
 * The tabs of a story about logic: its hook's signature, then its play's trace. Its scene takes no args, so the tabs
 * that set or list them (Props, Events) and the component's parts are left out, even when the hook's options look like
 * props.
 *
 * @param input - what the tabs are built from.
 * @param component - the hook's docs.
 */
const logicTabs = (input: DockTabsInput, component: ComponentDocs): DockTab[] => {
  const tabs: DockTab[] = [];
  if (component.signature !== undefined) {
    tabs.push({
      id: "signature",
      label: STRINGS.tabs.signature,
      content: (
        <div className="forgebook-signature-tab">
          <SignatureReference name={component.name} signature={component.signature} />
        </div>
      )
    });
  }
  if (input.trace !== undefined) tabs.push(interactionsTab(input.trace, input.onPlayAgain));
  return tabs;
};

/** The Interactions tab of a story whose play ran. */
const interactionsTab = (trace: PlayTrace, onPlayAgain: () => void): DockTab => ({
  id: "play",
  label: STRINGS.tabs.play,
  hint: interactionsHint(trace),
  content: <LazyTab module={INTERACTIONS_TAB} tabProps={{ trace, onPlayAgain }} />
});

/** The Code tab, when the story file has code: loading, loaded, or failed to load. */
const codeTabs = (input: DockTabsInput): DockTab[] => {
  const { code, docs } = input;
  // without the file's code, a story with a render would show the JSX of its args, which is not what it draws
  if (code.status === "none") return [];
  // the code's place while it loads: a story without props opens on the first tab, and without this one the first
  // would be the next (a plugin's), opened and its module loaded, before the code arrives and takes its place
  if (code.status === "loading") {
    return [{ id: "code", label: STRINGS.tabs.code, content: notice(STRINGS.codeLoading, false) }];
  }
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
        <LazyTab
          module={CODE_TAB}
          tabProps={{
            code: code.value,
            exportName: input.story.exportName,
            componentName: docs.status === "ready" ? codeNameOf(docs.value) : input.componentName,
            args: input.values
          }}
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
  ...input.pluginTabs,
  {
    id: "a11y",
    label: STRINGS.tabs.a11y,
    hint: a11yHint(input.check),
    content: <LazyTab module={A11Y_TAB} tabProps={{ check: input.check, onCheck: input.onCheck }} />
  }
];
