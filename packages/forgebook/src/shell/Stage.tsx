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

import { panelProps, settableProps } from "../argTypes.ts";
import { matrixOf, matrixProps } from "../matrix.ts";
import {
  type ArgValue,
  type PanelArgs,
  panelArgsParam,
  parsePanelArgsParam,
  type ShellMessage
} from "../messages.ts";
import type { NamedValues } from "../namedValues.ts";
import type { PlayTrace } from "../playTrace.ts";
import { type FixedView, withFixed, withOwnFixed } from "../storyGlobals.ts";
import type { TreeComponent, TreeStory } from "../storyTree.ts";
import type { ViewSwitch } from "../switches.ts";
import {
  frameAddress,
  isComparing,
  liveView,
  type MeasureTool,
  type PanelTab,
  type StageHeight,
  type StageWidth,
  schemeOf,
  type ViewState,
  viewParams,
  type Zoom
} from "../viewState.ts";
import { useStoryClockControls } from "./ClockControls.tsx";
import { useCatalogue } from "./catalogueContext.ts";
import {
  DeviceSlot,
  deviceAddress,
  isWaitingForDevice,
  roomSizing,
  useInkScheme,
  useStageDevice
} from "./DeviceSlot.tsx";
import { Dock } from "./Dock.tsx";
import { DroppedArgsNote } from "./DroppedArgsNote.tsx";
import { dockTabs } from "./dockTabs.tsx";
import { FrameView, tellFrames } from "./FrameView.tsx";
import { framesOrigin } from "./framesOrigin.ts";
import type { PluginReports, ShellPlugin } from "./pluginTabs.tsx";
import { type ReportedPanel, reportedPanel } from "./reportedPanel.ts";
import { StageCompare } from "./StageCompare.tsx";
import { StageTools } from "./StageTools.tsx";
import { StageViewport } from "./StageViewport.tsx";
import { StoryBar } from "./StoryBar.tsx";
import { STRINGS } from "./strings.ts";
import { useAddressArgs } from "./useAddressArgs.ts";
import {
  type CheckResult,
  type EventCall,
  type PluginReportMessage,
  type ReadyMessage,
  useFrameMessages
} from "./useFrameMessages.ts";
import { useLiveView, useLoadedView } from "./useLiveView.ts";
import { usePanelDocs } from "./usePanelDocs.ts";
import { usePluginStory, usePluginTabs } from "./usePluginTabs.ts";
import { type PageScroll, useScrollMemory } from "./useScrollMemory.ts";
import { useStoryCheck } from "./useStoryCheck.ts";
import { useStoryCode } from "./useStoryCode.ts";
import { useWorstCase } from "./useWorstCase.ts";

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
  /**
   * The values set in the Props tab, over the story's own args (kept in the address): as the address names them, so
   * unchecked; the stage hands the frames only those the story declares.
   */
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
 * Whether a story's args change what it draws: not for a story of fixed examples, nor for one about logic, whose scene
 * takes none.
 *
 * @param story - the story.
 */
const takesArgs = (story: Pick<TreeStory, "isLogic" | "controls">): boolean =>
  !story.isLogic && (story.controls === "all" || story.controls.length > 0);

/**
 * What an embed of the story keeps of the page: its view and the values set in the panel. An embed draws no device
 * frame, so the device chosen is left out: the embed is the story at the width its iframe gives it.
 *
 * @param view - the reader's view, without what the story fixes, which the story fixes again.
 * @param panelArgs - the values set in the panel.
 * @param switches - the catalogue's switches.
 */
const embedQuery = (view: ViewState, panelArgs: PanelArgs, switches: readonly ViewSwitch[]): string => {
  const params = viewParams({ ...view, device: "auto", orientation: "auto" }, switches);
  const args = panelArgsParam(panelArgs);
  if (args !== "") params.set("args", args);
  return params.toString();
};

/**
 * The height an embed's iframe starts at: as tall as the frame is on the stage.
 *
 * @param view - the view, with the height set on the stage.
 * @param contentHeight - the story's content, in CSS px.
 * @param story - the story, with the height its scene declares.
 */
const embedHeight = (view: ViewState, contentHeight: number, story: Pick<TreeStory, "height">): number =>
  view.height === "auto" ? Math.max(contentHeight, story.height ?? 0) : view.height;

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
  const catalogue = useCatalogue();
  const docs = usePanelDocs(loadDocs, component.name, storyArgs.get(story.id), panel.actions);
  const view = withFixed(ownView, panel.fixed);
  const onViewChange = (changed: ViewState): void =>
    onOwnViewChange(withOwnFixed(changed, ownView, panel.fixed));
  const [calls, setCalls] = useState<readonly EventCall[]>([]);
  // each story's play trace, by story: a trace belongs to the story that played
  const [traces, setTraces] = useState<ReadonlyMap<string, PlayTrace>>(new Map());
  // what each plugin's frame module last told its tab, by story: a plugin's report belongs to the story that sent it
  const [pluginReports, setPluginReports] = useState<PluginReports>(new Map());
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

  // the address's values reach the frames only once checked against what the story declares
  const addressArgs = useAddressArgs({
    panelArgs,
    docs,
    storyArgs: storyArgs.get(story.id),
    argTypes: panel.argTypes,
    controls: panel.controls,
    namedValues
  });
  const acceptedArgs = addressArgs.accepted;
  const values = { ...storyArgs.get(story.id), ...acceptedArgs };
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
    panelArgs: acceptedArgs,
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
      const send = (shellMessage: ShellMessage): void => frame.postMessage(shellMessage, framesOrigin());
      send({ type: "forgebook:events", names: eventNames });
      // checked against the shown story's declaration only: a late message of the story shown before sends nothing
      const accepted = message.storyId === story.id ? addressArgs.acceptedFor(message) : undefined;
      if (accepted !== undefined) send({ type: "forgebook:args", args: accepted });
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
      setPluginReports((current) => new Map(current).set(`${message.storyId}|${message.plugin}`, message)),
    // a story that changes its own args changes the panel's values, as the reader would
    // a story that could not be shown reports no args: the panel built from them has none, rather than waiting
    onFailed: (storyId: string): void =>
      setStoryArgs((current) => (current.has(storyId) ? current : new Map(current).set(storyId, {}))),
    onStoryArgs: (storyId: string, args: PanelArgs): void =>
      storyId === story.id ? onPanelArgsChange(args) : undefined
  });

  // the docs may arrive after the frames: they learn the events then
  useEffect(
    () => tellFrames(storyRef.current, { type: "forgebook:events", names: eventNames }),
    [eventNames]
  );
  useEffect(() => tellFrames(storyRef.current, { type: "forgebook:matrix", matrix }), [matrix]);
  // the values reach the frames from the address, so going back in the history sets them too; compared as text, so
  // a frame is told again only when they change
  const { acceptedParam } = addressArgs;
  useEffect(() => {
    if (acceptedParam === undefined) return;
    tellFrames(storyRef.current, { type: "forgebook:args", args: parsePanelArgsParam(acceptedParam) });
  }, [acceptedParam]);
  // a change starts from the values the story takes: one the address named and the story does not is let go
  const changeValue = (name: string, value: ArgValue | undefined): void => {
    const { [name]: _removed, ...rest } = acceptedArgs;
    onPanelArgsChange(value === undefined ? rest : { ...rest, [name]: value });
  };

  const replay = (): void => {
    const message: ShellMessage = { type: "forgebook:replay" };
    frameRef.current?.contentWindow?.postMessage(message, framesOrigin());
  };
  const title = STRINGS.frameTitle(component.name, story.name);
  const canReplay = replayable === story.id && !isComparing(view);
  // the compare view's frames each run their own clock from the start, so no one control drives them all
  const hasClock = clocked === story.id && !isComparing(view);
  // the frame loads again only for another story or style sheets; the rest of the view (the switches, the language
  // among them) is sent live
  // a device sets the story's width and height in place of the stage's own, and its story area is the toolbar's width
  const { shown, framed } = useStageDevice(view, story.device, onShownWidthChange);
  const address = deviceAddress(
    frameAddress(frameUrl, story.id, useLoadedView(`${story.id}|${view.sheets}`, view), switches),
    framed
  );
  useLiveView(storyRef, view, !isComparing(view));
  useScrollMemory(storyRef, scroll);
  const ink = useInkScheme(schemeOf(view, switches));
  // a story not shown yet waits at its measured height, or keeps the last story's, until it reports its own, so the
  // page does not jump twice
  const reportedHeight = heights.get(address);
  const [lastHeight, setLastHeight] = useState(INITIAL_FRAME_HEIGHT);
  useEffect(() => {
    if (reportedHeight !== undefined) setLastHeight(reportedHeight);
  }, [reportedHeight]);

  const pluginTabs = usePluginTabs({
    plugins,
    strings: catalogue.strings,
    story: usePluginStory(component, story),
    parameters: panel.parameters,
    reports: pluginReports,
    isComparing: isComparing(view),
    aside: {
      // as the stage draws it: at its device's screen width and told its safe areas
      address: deviceAddress(frameAddress(frameUrl, story.id, view, switches), framed),
      width: framed?.area.width ?? view.width,
      background: backgroundOf(view),
      args: panelArgs,
      view: liveView(view)
    }
  });

  // a tab the catalogue turns off is never shown
  const tabs = dockTabs({
    docs,
    code,
    story,
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
        { key, isChanged: acceptedArgs[name] !== undefined }
      ])
    ),
    propGroups: component.propGroups,
    calls: calls.filter((call) => call.storyId === story.id),
    onClearCalls: (): void => setCalls([]),
    trace: isComparing(view) ? undefined : traces.get(story.id),
    onPlayAgain: (): void => {
      const message: ShellMessage = { type: "forgebook:play-again" };
      frameRef.current?.contentWindow?.postMessage(message, framesOrigin());
    },
    check: storyCheck.check,
    onCheck: isComparing(view) ? undefined : storyCheck.run,
    pluginTabs
  }).filter((tab) => catalogue.tabs.includes(tab.id));

  return (
    <div className="forgebook-workspace">
      {header}
      <div className="forgebook-story-pane">
        <div ref={storyRef} className="forgebook-scroll">
          <section className="forgebook-story" aria-label={STRINGS.storyLabel}>
            <StoryBar
              story={story}
              axisProps={axisProps}
              matrixAxes={matrixAxes}
              onMatrixAxesChange={onMatrixAxesChange}
              onReplay={canReplay ? replay : undefined}
              clockControls={hasClock ? clockControls : undefined}
              frameAddress={frameAddress(frameUrl, story.id, view, switches)}
              embed={{
                title,
                query: embedQuery(ownView, panelArgs, switches),
                height: embedHeight(view, reportedHeight ?? lastHeight, story)
              }}
            />
            <DroppedArgsNote
              dropped={addressArgs.dropped}
              onRemove={(): void => onPanelArgsChange(acceptedArgs)}
            />
            {isComparing(view) ? (
              <StageCompare
                story={story}
                title={title}
                view={view}
                frameUrl={frameUrl}
                framed={framed}
                heights={heights}
                settled={settled}
                fallbackHeight={lastHeight}
                backgroundOf={backgroundOf}
              />
            ) : (
              <StageViewport
                zoom={view.zoom}
                {...roomSizing(framed, {
                  width: view.width,
                  onWidthChange: widthSetter(panel.fixed, view, onViewChange),
                  onShownWidthChange,
                  background: backgroundOf(view),
                  height: view.height,
                  onHeightChange: (height: StageHeight): void => onViewChange({ ...view, height })
                })}
              >
                {(fixedHeight: number | undefined): ReactNode => (
                  <DeviceSlot framed={framed} scheme={ink} background={backgroundOf(view)}>
                    {isWaitingForDevice(shown, framed) ? null : (
                      <FrameView
                        ref={frameRef}
                        key={story.id}
                        title={title}
                        address={address}
                        heights={heights}
                        settled={settled}
                        fallbackHeight={measuredHeight ?? lastHeight}
                        sceneHeight={story.height}
                        fixedHeight={framed?.area.height ?? fixedHeight}
                      />
                    )}
                  </DeviceSlot>
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
