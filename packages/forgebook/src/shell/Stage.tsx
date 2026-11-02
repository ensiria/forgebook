/**
 * The stage: the chosen story in its frame, at the view's width, with Replay, a Live story's clock controls
 * and a link to the frame alone, or the
 * four variants side by side in the compare view; the panel docked under it when it is open.
 *
 * @remarks
 * The story and the panel scroll apart: reading the props, the code or the accessibility results never moves the
 * story away. The view's live part (theme, contrast, motion, text size) reaches the shown frame as a message, so the
 * story keeps its state; only the story, the style sheets or the language load the frame again.
 *
 * @module
 */

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { type PanelArgTypes, panelProps, settableProps } from "../argTypes.ts";
import { matrixOf, matrixProps } from "../matrix.ts";
import type { ArgValue, PanelArgs, ShellMessage } from "../messages.ts";
import type { NamedValues } from "../namedValues.ts";
import type { PlayTrace } from "../playTrace.ts";
import type { PluginStory } from "../plugin.ts";
import { type FixedView, NOT_FIXED, withFixed, withOwnFixed } from "../storyGlobals.ts";
import type { TreeComponent, TreeStory } from "../storyTree.ts";
import {
  frameAddress,
  isComparing,
  liveView,
  type MeasureTool,
  type PanelTab,
  type StageHeight,
  type StageWidth,
  type ViewState,
  type Zoom
} from "../viewState.ts";
import { ClockControls, useStoryClockControls } from "./ClockControls.tsx";
import { useCatalogue } from "./catalogueContext.ts";
import { compareVariants } from "./compareVariants.ts";
import { Dock } from "./Dock.tsx";
import { dockTabs } from "./dockTabs.tsx";
import { FrameView, tellFrames } from "./FrameView.tsx";
import { Icon } from "./icons.tsx";
import { MatrixPicker } from "./MatrixPicker.tsx";
import { type PluginReports, pluginTabsFor, type ShellPlugin } from "./pluginTabs.tsx";
import { StageTools } from "./StageTools.tsx";
import { StageViewport } from "./StageViewport.tsx";
import { STRINGS } from "./strings.ts";
import { useComponentDocs } from "./useComponentDocs.ts";
import { useCopy } from "./useCopy.ts";
import {
  type CheckResult,
  type EventCall,
  type PluginReportMessage,
  type ReadyMessage,
  useFrameMessages
} from "./useFrameMessages.ts";
import { useLiveView, useLoadedView } from "./useLiveView.ts";
import { type PageScroll, useScrollMemory } from "./useScrollMemory.ts";
import { useStoryCheck } from "./useStoryCheck.ts";
import { useStoryCode } from "./useStoryCode.ts";
import { useWorstCase } from "./useWorstCase.ts";

/** The `argTypes` of a story before its frame reported them. */
const NO_ARG_TYPES: PanelArgTypes = {};

/** What a story's frame reports for the panel and the stage. */
type ReportedPanel = Pick<ReadyMessage, "argTypes" | "controls" | "actions" | "fixed" | "parameters">;

/**
 * What the stage's handles set the width with; none, so no handles, when the story fixes the width.
 *
 * @param fixed - what the story fixes.
 * @param view - the view shown.
 * @param onViewChange - the view's setter.
 */
const widthSetter = (
  fixed: FixedView,
  view: ViewState,
  onViewChange: (view: ViewState) => void
): ((width: StageWidth) => void) | undefined =>
  fixed.width === undefined ? (width: StageWidth): void => onViewChange({ ...view, width }) : undefined;

/**
 * A story's `argTypes`, controls, actions and fixed view for the panel and the stage: as its frame read them once it ran, which sees a setting
 * written by code the index leaves out; the index's controls and no `argTypes` or actions before.
 *
 * @param panels - what each story's frame reported, by story.
 * @param story - the story.
 */
const reportedPanel = (panels: ReadonlyMap<string, ReportedPanel>, story: TreeStory): ReportedPanel =>
  panels.get(story.id) ?? {
    argTypes: NO_ARG_TYPES,
    controls: story.controls,
    actions: [],
    fixed: NOT_FIXED,
    parameters: []
  };

/** The height of the first frame before its story reports its own, in CSS px. */
const INITIAL_FRAME_HEIGHT = 240;

/** The most calls the Events tab keeps. */
const MAX_CALLS = 50;

/** The stage's props. */
export type StageProps = {
  /** The component the story belongs to. */
  readonly component: TreeComponent;
  /** The shown story. */
  readonly story: TreeStory;
  /** The view. */
  readonly view: ViewState;
  /** Called with the changed view (the width the handle set, the panel's tab). */
  readonly onViewChange: (view: ViewState) => void;
  /** Called with what a story fixes of the view, once its frame read it, for the toolbar to show. */
  readonly onFixedChange: (storyId: string, fixed: FixedView) => void;
  /** The values set in the Props tab, over the story's own args (kept in the address). */
  readonly panelArgs: PanelArgs;
  /** Called with the panel's changed values. */
  readonly onPanelArgsChange: (args: PanelArgs) => void;
  /** The matrix's axes (kept in the address): the rows' prop, then the columns'; empty draws the story alone. */
  readonly matrixAxes: readonly string[];
  /** Called with the chosen axes. */
  readonly onMatrixAxesChange: (axes: readonly string[]) => void;
  /** The frame page's address. */
  readonly frameUrl: string;
  /** The plugins with tabs. */
  readonly plugins: readonly ShellPlugin[];
  /** Loads the story file's code for the Code tab; `undefined` when the source has none. */
  readonly loadCode: (() => Promise<unknown>) | undefined;
  /** Loads the component's docs for the panel; `undefined` when the source has none for the file. */
  readonly loadDocs: (() => Promise<unknown>) | undefined;
  /** The values the story's source names for types the panel cannot write (icons). */
  readonly namedValues: NamedValues | undefined;
  /** What stays above the story while it scrolls: the component's header. */
  readonly header: ReactNode;
  /** Called with the width the story really has, for the toolbar's width field. */
  readonly onShownWidthChange: (width: number | undefined) => void;
  /** The story's measured height at about its width (`forgebook-heights`), for its box while it loads; none unmeasured. */
  readonly measuredHeight: number | undefined;
  /**
   * The colour the story's page has in a view (its source's, or the backdrop's when the view draws one), which its
   * box waits on; none without one.
   */
  readonly backgroundOf: (view: Pick<ViewState, "switches" | "backdrop">) => string | undefined;
  /** Where its scrolling part starts: the shell's visit of the page and every page's last position. */
  readonly scroll: PageScroll;
};

/**
 * Copies the story's id (`kit:inputs-selection-select--overview`), the name tests and tools address it by; the id
 * shows as the button's tooltip.
 *
 * @param props - the story's id.
 */
const CopyIdButton = ({ storyId }: { readonly storyId: string }): ReactNode => {
  const { isCopied, copy } = useCopy();
  return (
    <button
      type="button"
      className="forgebook-button forgebook-button--icon"
      title={`${STRINGS.copyStoryId}: ${storyId}`}
      aria-label={isCopied ? STRINGS.copied : STRINGS.copyStoryId}
      onClick={(): void => copy(storyId)}
    >
      <Icon name={isCopied ? "check" : "hash"} size={14} />
    </button>
  );
};

/**
 * Whether a story's args change what it draws: not for a story of fixed examples, nor for one about logic, whose scene
 * takes none.
 *
 * @param story - the story.
 */
const takesArgs = (story: Pick<TreeStory, "isLogic" | "controls">): boolean =>
  !story.isLogic && (story.controls === "all" || story.controls.length > 0);

/**
 * The stage.
 *
 * @param props - the component, the story, the view, the panel's values, the frame page and the loaders.
 */
export const Stage = ({
  component,
  story,
  view: ownView,
  onViewChange: onOwnViewChange,
  onFixedChange,
  panelArgs,
  onPanelArgsChange,
  matrixAxes,
  onMatrixAxesChange,
  frameUrl,
  plugins,
  loadCode,
  loadDocs,
  namedValues,
  header,
  onShownWidthChange,
  measuredHeight,
  backgroundOf,
  scroll
}: StageProps): ReactNode => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const storyRef = useRef<HTMLDivElement>(null);
  const docs = useComponentDocs(loadDocs);
  const code = useStoryCode(loadCode);
  // the story's own args, as each frame reported them, by story
  const [storyArgs, setStoryArgs] = useState<ReadonlyMap<string, PanelArgs>>(new Map());
  // the args each story gives a text by its key, as its frame reported them
  const [storyTextKeys, setStoryTextKeys] = useState<ReadonlyMap<string, Readonly<Record<string, string>>>>(
    new Map()
  );
  // each story's `argTypes` and controls, as its frame read them once it ran
  const [storyPanels, setStoryPanels] = useState<ReadonlyMap<string, ReportedPanel>>(new Map());
  // the story is drawn with what it fixes of the view; a change from here keeps the user's own in the address
  const panel = reportedPanel(storyPanels, story);
  const view = withFixed(ownView, panel.fixed);
  const onViewChange = (changed: ViewState): void =>
    onOwnViewChange(withOwnFixed(changed, ownView, panel.fixed));
  const [calls, setCalls] = useState<readonly EventCall[]>([]);
  // each story's play trace, by story: a trace belongs to the story that played
  const [traces, setTraces] = useState<ReadonlyMap<string, PlayTrace>>(new Map());
  // what each plugin's frame module last told its tab, by story: a plugin's report belongs to the story that sent it
  const [pluginReports, setPluginReports] = useState<PluginReports>(new Map());
  const catalogue = useCatalogue();
  const { switches } = catalogue;
  const storyCheck = useStoryCheck(frameRef, frameAddress(frameUrl, story.id, view, switches));
  const eventNames = useMemo(
    () =>
      docs.status === "ready"
        ? docs.value.props.filter((prop) => prop.kind === "event").map((prop) => prop.name)
        : [],
    [docs]
  );

  // a story of fixed examples, or about logic (its scene takes no args), ignores its args, so a matrix of them would
  // repeat one drawing
  const axisProps = docs.status === "ready" && takesArgs(story) ? matrixProps(docs.value.props) : [];
  const matrix = useMemo(
    () =>
      (docs.status === "ready" && !story.isLogic ? matrixOf(docs.value.props, matrixAxes) : undefined) ??
      null,
    [docs, matrixAxes, story.isLogic]
  );

  const values = { ...storyArgs.get(story.id), ...panelArgs };
  const settable = useMemo(
    () =>
      docs.status === "ready"
        ? settableProps(panelProps(docs.value.props, panel.argTypes), panel.controls, namedValues ?? {})
        : [],
    [docs, panel.argTypes, panel.controls, namedValues]
  );
  const worstCase = useWorstCase({
    storyRef,
    storyId: story.id,
    settable,
    values,
    panelArgs,
    onPanelArgsChange
  });

  const clockControls = useStoryClockControls(frameRef, story.id);
  const { replayable, clocked, heights, settled } = useFrameMessages({
    onReady: (frame: Window, message: ReadyMessage): void => {
      setStoryArgs((current) => new Map(current).set(message.storyId, message.args));
      setStoryTextKeys((current) => new Map(current).set(message.storyId, message.textKeys));
      setStoryPanels((current) =>
        new Map(current).set(message.storyId, {
          argTypes: message.argTypes,
          controls: message.controls,
          actions: message.actions,
          fixed: message.fixed,
          parameters: message.parameters
        })
      );
      onFixedChange(message.storyId, message.fixed);
      const send = (shellMessage: ShellMessage): void =>
        frame.postMessage(shellMessage, window.location.origin);
      send({ type: "forgebook:events", names: eventNames });
      send({ type: "forgebook:args", args: panelArgs });
      send({ type: "forgebook:matrix", matrix });
      // the view may have changed while the frame loaded
      if (!isComparing(view)) send({ type: "forgebook:view", view: liveView(view) });
      send({ type: "forgebook:tools", tools: view.tools });
      worstCase.sendTo(frame);
      if (message.hasClock && !isComparing(view)) clockControls.sendTo(frame);
    },
    onCall: (call: EventCall): void => setCalls((current) => [call, ...current].slice(0, MAX_CALLS)),
    onPlay: (storyId: string, trace: PlayTrace): void =>
      setTraces((current) => new Map(current).set(storyId, trace)),
    onChecked: (result: CheckResult): void => {
      if (result.storyId === story.id) storyCheck.receive(result);
    },
    onSpills: worstCase.receive,
    onPluginReport: (message: PluginReportMessage): void =>
      setPluginReports((current) => new Map(current).set(`${message.storyId}|${message.plugin}`, message))
  });

  // the docs may arrive after the frames: they learn the events then
  useEffect(
    () => tellFrames(storyRef.current, { type: "forgebook:events", names: eventNames }),
    [eventNames]
  );
  useEffect(() => tellFrames(storyRef.current, { type: "forgebook:matrix", matrix }), [matrix]);
  // the values reach the frames from the address, so going back in the history sets them too
  useEffect(() => tellFrames(storyRef.current, { type: "forgebook:args", args: panelArgs }), [panelArgs]);
  const changeValue = (name: string, value: ArgValue | undefined): void => {
    const { [name]: _removed, ...rest } = panelArgs;
    onPanelArgsChange(value === undefined ? rest : { ...rest, [name]: value });
  };

  const replay = (): void => {
    const message: ShellMessage = { type: "forgebook:replay" };
    frameRef.current?.contentWindow?.postMessage(message, window.location.origin);
  };
  const title = STRINGS.frameTitle(component.name, story.name);
  const canReplay = replayable === story.id && !isComparing(view);
  // the compare view's frames each run their own clock from the start, so no one control drives them all
  const hasClock = clocked === story.id && !isComparing(view);
  // the frame loads again only for another story or style sheets; the rest of the view (the switches, the language
  // among them) is sent live
  const address = frameAddress(
    frameUrl,
    story.id,
    useLoadedView(`${story.id}|${view.sheets}`, view),
    switches
  );
  useLiveView(storyRef, view, !isComparing(view));
  useScrollMemory(storyRef, scroll);
  // a story not shown yet waits at its measured height, or keeps the last story's, until it reports its own, so the
  // page does not jump twice
  const reportedHeight = heights.get(address);
  const [lastHeight, setLastHeight] = useState(INITIAL_FRAME_HEIGHT);
  useEffect(() => {
    if (reportedHeight !== undefined) setLastHeight(reportedHeight);
  }, [reportedHeight]);

  const pluginStory = useMemo(
    (): PluginStory => ({
      id: story.id,
      name: story.name,
      title: component.title,
      componentName: component.name,
      isLogic: story.isLogic,
      design: story.design
    }),
    [story, component]
  );

  // a tab the catalogue turns off is never shown
  const tabs = dockTabs({
    docs,
    code,
    exportName: story.exportName,
    isLogic: story.isLogic,
    componentName: component.name,
    argTypes: panel.argTypes,
    controls: panel.controls,
    actions: panel.actions,
    values,
    onValueChange: changeValue,
    onReset: (): void => onPanelArgsChange({}),
    worstCase: worstCase.state,
    namedValues,
    textArgs: Object.fromEntries(
      Object.entries(storyTextKeys.get(story.id) ?? {}).map(([name, key]) => [
        name,
        { key, isChanged: panelArgs[name] !== undefined }
      ])
    ),
    calls: calls.filter((call) => call.storyId === story.id),
    onClearCalls: (): void => setCalls([]),
    trace: isComparing(view) ? undefined : traces.get(story.id),
    onPlayAgain: (): void => {
      const message: ShellMessage = { type: "forgebook:play-again" };
      frameRef.current?.contentWindow?.postMessage(message, window.location.origin);
    },
    check: storyCheck.check,
    onCheck: isComparing(view) ? undefined : storyCheck.run,
    pluginTabs: pluginTabsFor({
      plugins,
      strings: catalogue.strings,
      story: pluginStory,
      parameters: panel.parameters,
      reports: pluginReports,
      isComparing: isComparing(view),
      aside: {
        address: frameAddress(frameUrl, story.id, view, switches),
        width: view.width,
        background: backgroundOf(view),
        args: panelArgs,
        view: liveView(view)
      }
    })
  }).filter((tab) => catalogue.tabs.includes(tab.id));

  return (
    <div className="forgebook-workspace">
      {header}
      <div className="forgebook-story-pane">
        <div ref={storyRef} className="forgebook-scroll">
          <section className="forgebook-story" aria-label={STRINGS.storyLabel}>
            <div className="forgebook-story__bar">
              <div className="forgebook-stage__heading">
                <h2 className="forgebook-stage__title">{story.name}</h2>
                {story.description === undefined ? null : (
                  <p className="forgebook-stage__description" title={story.description}>
                    {story.description}
                  </p>
                )}
              </div>
              {axisProps.length === 0 ? null : (
                <MatrixPicker props={axisProps} axes={matrixAxes} onAxesChange={onMatrixAxesChange} />
              )}
              {canReplay ? (
                <button type="button" className="forgebook-button" onClick={replay}>
                  <Icon name="replay" size={14} />
                  {STRINGS.replay}
                </button>
              ) : null}
              {hasClock ? <ClockControls controls={clockControls} /> : null}
              <CopyIdButton storyId={story.id} />
              <a
                className="forgebook-button forgebook-button--icon"
                href={frameAddress(frameUrl, story.id, view, switches)}
                target="_blank"
                rel="noopener"
                title={STRINGS.openFrame}
                aria-label={STRINGS.openFrame}
              >
                <Icon name="external" size={14} />
              </a>
            </div>
            {isComparing(view) ? (
              <div className="forgebook-compare">
                {compareVariants(view.compare, catalogue).map((variant) => (
                  <figure
                    key={variant.label}
                    className="forgebook-compare__cell"
                    // the label (the shell's text) reads on the page's colour; the frame draws the backdrop
                    style={{ backgroundColor: backgroundOf({ ...variant.viewOf(view), backdrop: "plain" }) }}
                  >
                    <figcaption className="forgebook-compare__label">{variant.label}</figcaption>
                    <FrameView
                      title={`${title} · ${variant.label}`}
                      address={frameAddress(frameUrl, story.id, variant.viewOf(view), switches)}
                      heights={heights}
                      settled={settled}
                      fallbackHeight={lastHeight}
                      sceneHeight={story.height}
                    />
                  </figure>
                ))}
              </div>
            ) : (
              <StageViewport
                zoom={view.zoom}
                width={view.width}
                onWidthChange={widthSetter(panel.fixed, view, onViewChange)}
                onShownWidthChange={onShownWidthChange}
                background={backgroundOf(view)}
                height={view.height}
                onHeightChange={(height: StageHeight): void => onViewChange({ ...view, height })}
              >
                {(fixedHeight: number | undefined): ReactNode => (
                  <FrameView
                    ref={frameRef}
                    key={story.id}
                    title={title}
                    address={address}
                    heights={heights}
                    settled={settled}
                    fallbackHeight={measuredHeight ?? lastHeight}
                    sceneHeight={story.height}
                    fixedHeight={fixedHeight}
                  />
                )}
              </StageViewport>
            )}
          </section>
        </div>
        {/* outside the scrolling part: the tools stay in the pane's corner whatever the story's height or zoom */}
        {isComparing(view) ? null : (
          <StageTools
            zoom={view.zoom}
            onZoomChange={(zoom: Zoom): void => onViewChange({ ...view, zoom })}
            tools={view.tools}
            onToolsChange={(tools: readonly MeasureTool[]): void => onViewChange({ ...view, tools })}
          />
        )}
      </div>
      {view.isPanelOpen ? (
        <Dock
          tabs={tabs}
          activeTab={view.panelTab}
          onTabChange={(panelTab: PanelTab): void => onViewChange({ ...view, panelTab })}
          onClose={(): void => onViewChange({ ...view, isPanelOpen: false })}
        />
      ) : null}
    </div>
  );
};
