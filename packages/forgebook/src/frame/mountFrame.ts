/**
 * The entry of a story's frame: reads the story and the view from the address, loads the source's style sheets for
 * the view, then has the framework draw the story and, once its play function is over, tells the shell it is ready.
 *
 * @remarks
 * One document per story: the style sheets of the Styles setting, the switches on the root and anything the
 * story mounts on `body` stay in this document. The tests open the same address and wait for `data-forgebook-status`
 * on the root (`ready`, `error` or `pending`), never for a delay. A Live story's clock runs from its start, or stays held there when
 * the address says so (`clock=held`, what the tests open). The framework is the renderer the framework package
 * passes (`renderer.ts`); nothing here depends on one.
 *
 * @module
 */
import "./frame.scss";

import type { StoryLanguage, StorySource } from "@forgebook/story-format/source";
import { storyTextOf } from "@forgebook/story-format/texts";

import { bundlerErrorLines } from "../bundlerErrors.ts";
import { type A11ySettings, type CatalogueLists, catalogueSettings } from "../catalogue.ts";
import { type FramesPlacement, SAME_ORIGIN } from "../frameOrigins.ts";
import { PREVIEWS_EVENT, previewsRenewalOf, STORY_FILE_EVENT, successionOf } from "../hotModules.ts";
import { shownLanguage } from "../languages.ts";
import {
  isMappedStackAnswer,
  LIVE_ERROR_EVENT,
  type LiveErrorReport,
  MAPPED_STACK_EVENT
} from "../liveErrors.ts";
import type { PanelArgs, ShellMessage } from "../messages.ts";
import type { PlayTrace } from "../playTrace.ts";
import { applySafeArea } from "../safeAreaParameter.ts";
import { sourceFiles } from "../sourceFiles.ts";
import { actionNames, excludedControls, panelArgTypesOf } from "../storyArgTypes.ts";
import { isClockHeldIn } from "../storyClock.ts";
import { type FixedView, fixedViewOf, NOT_FIXED, withFixed } from "../storyGlobals.ts";
import { shownTexts, storyTextKeysOf, withStoryTexts } from "../storyTexts.ts";
import { findStory, storyTree } from "../storyTree.ts";
import { catalogueSwitches, type ViewSwitch } from "../switches.ts";
import {
  codeGlobalsOf,
  frameAddress,
  isSameLiveView,
  type LiveView,
  languageOf,
  liveView,
  type MeasureTool,
  parseView,
  type SheetsChoice
} from "../viewState.ts";
import { detailOf, previewValue } from "./callValues.ts";
import { followCanvasScheme } from "./canvasScheme.ts";
import { followTouch } from "./followTouch.ts";
import { storyFrameClock } from "./frameClock.ts";
import {
  ERROR_MESSAGE_CLASS,
  ERROR_STACK_CLASS,
  FRAME_STARTED_ATTRIBUTE,
  NOT_AWAITED_ATTRIBUTE,
  PENDING_REASON_ATTRIBUTE,
  STATUS_ATTRIBUTE
} from "./frameStatus.ts";
import { applyView, loadSheets, viewSheets } from "./frameView.ts";
import { panelArgsOf, storyArgsOf } from "./panelValues.ts";
import type { PlayToolsLoader } from "./playStory.ts";
import { type FramePlugin, startPluginFrames } from "./pluginFrames.ts";
import type { FrameRenderer, StoryDrawing } from "./renderer.ts";
import { type ShellChannel, shellChannel } from "./shellChannel.ts";
import { checkForShell } from "./shellCheck.ts";
import { spillOutline } from "./spillOutline.ts";
import { clearRetry, isStaleModuleError, markRetry, sessionStorageOf } from "./staleModule.ts";
import type { StoryOutcome } from "./storyContent.ts";
import { mergedPreviews, readPreview, readStory, startingGlobals } from "./storyModule.ts";
import { runStory, type StoryControls, type StoryRunOptions } from "./storyRun.ts";
import type { ValueSheets } from "./valueSheets.ts";

/** What an app passes to the frame. */
export type FrameConfig = {
  /** The framework that draws the stories (`@forgebook/react` passes its own). */
  readonly renderer: FrameRenderer;
  /** The sources the shell shows, in the same order. */
  readonly sources: readonly StorySource[];
  /** The address of axe's script, for the Accessibility card; the generated page gives it. */
  readonly axeUrl?: string;
  /** The languages every story can be drawn in, as the shell's configuration gives them; none turns them off. */
  readonly languages?: readonly StoryLanguage[];
  /**
   * The catalogue's previews, as their modules: its presets' first, its own last (`forgebook.preview.ts`). Their
   * decorators wrap every story, their parameters sit under every meta's, their setups run before any story renders.
   */
  readonly previews?: readonly unknown[];
  /** The switches of the toolbar and the View menu, as the shell's configuration gives them; the theme and contrast by default. */
  readonly switches?: readonly ViewSwitch[];
  /**
   * The address of each switch value's own style sheet, by `<switch id>=<value>`; none when no value has one. The
   * generated frame gives addresses the configuration's check allowed; the page checks nothing itself.
   */
  readonly valueSheets?: ValueSheets;
  /** The catalogue's lists (its backgrounds, text sizes, grid step, accessibility rules…); the defaults when none. */
  readonly lists?: CatalogueLists;
  /** Loads the play tools, when the project installs Testing Library (the generated frame passes it then). */
  readonly playTools?: PlayToolsLoader;
  /** The plugins with a frame module (the generated frame passes them); none by default. */
  readonly plugins?: readonly FramePlugin[];
  /** Where the frames run, so the frame hears only its shell: on the catalogue's own origin by default. */
  readonly frames?: FramesPlacement;
};

/**
 * Tells the dev server about an error, for an agent following them (`forgebook errors`); nothing in a build, which has
 * no connection to it.
 *
 * @param report - the error.
 */
const tellDevServer = (report: LiveErrorReport): void => {
  import.meta.hot?.send(LIVE_ERROR_EVENT, report);
};

// the browser writes a stack in the lines of the code Vite served, and the dev server answers with the lines as written
import.meta.hot?.on(MAPPED_STACK_EVENT, (answer: unknown): void => {
  if (!isMappedStackAnswer(answer)) return;
  for (const shown of document.querySelectorAll(`.${ERROR_STACK_CLASS}`))
    if (shown.textContent === answer.sent) shown.textContent = answer.stack;
});

// a story that threw is gone from its frame, so a hot update has nothing to update: the fix shows only in a new page; a
// story the frame gave up on keeps saying so until a new page waits for it again
import.meta.hot?.on("vite:afterUpdate", (): void => {
  const status = document.documentElement.getAttribute(STATUS_ATTRIBUTE);
  if (status === "error" || status === "pending") window.location.reload();
});

/**
 * Why the dev server last failed to serve a module, and what to do when it says so: of a module it failed to serve, a
 * browser says only that the import failed, and the reason reaches the page on the dev server's own channel.
 */
let servedError: string | undefined;
let followServedError: (() => void) | undefined;
import.meta.hot?.on("vite:error", ({ err }): void => {
  // the first since this page loaded: what its own import asked for, not what another frame's asked for later
  servedError ??= bundlerErrorLines(err.message, err)[0];
  followServedError?.();
  followServedError = undefined;
});

/** What shows the sheets of the values drawn, and answers once they have loaded whether it is still the last asked. */
type ValueSheetsShower = (values: Readonly<Record<string, string>>) => Promise<boolean>;

/**
 * What shows the sheets of a frame's values; none for a catalogue with none, which so loads no code for them.
 *
 * @param valueSheets - each value's sheet, when the catalogue has any.
 * @param sheets - the frame's Styles setting.
 * @param switches - the catalogue's switches.
 * @param onFailed - told a sheet that did not load: the story is drawn without it.
 */
const valueSheetsShower = async (
  valueSheets: ValueSheets | undefined,
  sheets: SheetsChoice,
  switches: readonly ViewSwitch[],
  onFailed: (message: string) => void
): Promise<ValueSheetsShower | undefined> => {
  if (valueSheets === undefined) return undefined;
  const { valueSheetUrls, valueSheetsIn } = await import("./valueSheets.ts");
  const show = valueSheetsIn(document, onFailed);
  return (values: Readonly<Record<string, string>>): Promise<boolean> =>
    show(valueSheetUrls(values, sheets, valueSheets, switches));
};

/**
 * Fails a frame whose story did not load, with the dev server's reason when the import only says it failed, as soon as
 * the reason arrives: it may come after the failed import.
 *
 * @param message - the error's message.
 * @param fail - shows a reason in the frame.
 */
const failedToLoad = (message: string, fail: (reason: string) => void): void => {
  if (isStaleModuleError(message)) followServedError = (): void => fail(servedError ?? message);
  fail(isStaleModuleError(message) ? (servedError ?? message) : message);
};

/**
 * Does what a message of the shell asks of the rendered story; the view's live part is applied apart, before the story
 * loads.
 *
 * @param message - the message.
 * @param controls - the rendered story's controls.
 * @param storyId - the story's id, for the answers.
 * @param pendingReason - why the story was not seen in its final state, if so: a check of what it shows now would pass
 *   on a fallback, so it answers this instead.
 * @param rules - the catalogue's accessibility rules, for a check; none when it checks no accessibility.
 * @param axeUrl - the address of axe's script, for a check.
 * @param tellShell - tells the shell the check's result.
 */
const answerShell = (
  message: ShellMessage,
  controls: StoryControls,
  storyId: string,
  pendingReason: string | undefined,
  rules: A11ySettings | undefined,
  axeUrl: string | undefined,
  tellShell: ShellChannel["tell"]
): void => {
  if (message.type === "forgebook:replay") void controls.replay();
  else if (message.type === "forgebook:args") controls.setPanelArgs(message.args);
  else if (message.type === "forgebook:events") controls.setEvents(message.names);
  else if (message.type === "forgebook:matrix") controls.setMatrix(message.matrix ?? undefined);
  else if (message.type === "forgebook:play-step") controls.stepPlay(message.command);
  else if (message.type === "forgebook:clock") controls.setClock(message.state);
  else if (message.type === "forgebook:clock-restart") controls.restartClock();
  else if (message.type === "forgebook:check")
    checkForShell(storyId, pendingReason, rules, axeUrl, tellShell);
};

/**
 * Says on the page that the frame gave up on what the story loads: a person looking at the story, or at its picture,
 * must not take the fallback for the story. Out of the story's own element, so the story is laid out as it was.
 *
 * @param reason - why.
 */
const showPending = (reason: string): void => {
  const notice = document.createElement("p");
  notice.className = "forgebook-frame-pending";
  notice.setAttribute("role", "status");
  notice.textContent = `Not verified: ${reason}`;
  document.body.prepend(notice);
};

/**
 * Says how a story ended on the frame's root and on its page.
 *
 * @param outcome - how it ended; an error that came during the wait stands, and this leaves it there.
 * @param storyId - the story's id, for the dev server.
 * @param isNotAwaited - whether the story said not to wait for what it loads, which a check reports.
 * @returns why it was not seen in its final state, if so.
 */
const showOutcome = (outcome: StoryOutcome, storyId: string, isNotAwaited: boolean): string | undefined => {
  if (outcome.status === "error") return undefined;
  if (isNotAwaited) document.documentElement.setAttribute(NOT_AWAITED_ATTRIBUTE, "");
  document.documentElement.setAttribute(STATUS_ATTRIBUTE, outcome.status);
  if (outcome.status === "ready") return undefined;
  document.documentElement.setAttribute(PENDING_REASON_ATTRIBUTE, outcome.reason);
  showPending(outcome.reason);
  tellDevServer({ kind: "render", storyId, view: window.location.search, message: outcome.reason });
  return outcome.reason;
};

/** The play tools a project installed, for a story that uses them. */
const playToolsOf = ({ playTools }: FrameConfig): Pick<StoryRunOptions, "playTools"> =>
  playTools === undefined ? {} : { playTools };

/**
 * Shows the story the address names in the given element.
 *
 * @param container - the element the story renders into.
 * @param config - the sources.
 */
export const mountFrame = async (container: HTMLElement, config: FrameConfig): Promise<void> => {
  // from here the frame shows its own errors: the page's guard against code that fails before it stands down
  document.documentElement.setAttribute(FRAME_STARTED_ATTRIBUTE, "");
  const params = new URLSearchParams(window.location.search);
  const storyId = params.get("story") ?? "";
  const languages = config.languages ?? [];
  const switches = catalogueSwitches(config.switches, languages, config.lists?.controls);
  const catalogue = catalogueSettings("", switches, config.lists);
  // the previews' modules: an edit of one (or of what it imports) brings its successor
  let previews: readonly unknown[] = config.previews ?? [];
  let preview = mergedPreviews(previews.map(readPreview));
  const view = parseView(window.location.search, catalogue);
  const shell = shellChannel(config.frames ?? SAME_ORIGIN, window);
  const tellShell = shell.tell;
  applyView(document.documentElement, view, catalogue);
  // a story drawn edge to edge in a device is told its safe areas, which `env()` cannot give a frame
  applySafeArea(document.documentElement, window.location.search);
  // what the story fixes of the view, once it is read: every view the frame applies has it over the shell's
  let fixed: FixedView = NOT_FIXED;
  // set once the story runs: a view the shell sends then changes its language and its globals without a new mount
  let changeShown: ((live: LiveView) => void) | undefined;
  // the view both the root and the story's drawing show; none when they may differ, so the next view is applied whatever
  // it says: a view that comes before the story runs reaches only the root, and an edit draws the story with new globals
  let shownView: LiveView | undefined = liveView(view);
  // the shell sends the live part of a changed view: applied on the root, and kept in the address so a reload (an
  // edit, a stale module) shows the same view
  const showSpills = spillOutline(document, ".forgebook-frame", (count) =>
    tellShell({ type: "forgebook:spills", storyId, count })
  );
  // observed from the start, so the shell sizes the frame to an error as well as to a story
  const reportSize = (): void => {
    // the body's own height: the root's scroll height never drops below the frame's, so a story could not shrink
    const height = Math.ceil(document.body.getBoundingClientRect().height);
    tellShell({ type: "forgebook:size", storyId, height });
  };
  new ResizeObserver(reportSize).observe(document.body);
  const reportScheme = followCanvasScheme(document, window, storyId, tellShell);
  const reportError = (message: string, stack?: string): void => {
    document.documentElement.setAttribute(STATUS_ATTRIBUTE, "error");
    tellShell({ type: "forgebook:error", storyId, message });
    const report: LiveErrorReport = { kind: "render", storyId, view: window.location.search, message };
    tellDevServer(stack === undefined ? report : { ...report, stack });
  };
  const fail = (message: string): void => {
    const box = document.createElement("div");
    box.className = "forgebook-frame-error";
    box.setAttribute("role", "alert");
    const text = document.createElement("p");
    text.className = ERROR_MESSAGE_CLASS;
    text.textContent = message;
    box.append(text);
    container.replaceChildren(box);
    reportError(message);
  };

  // the measuring tools load when one is first turned on: the shell tells every frame, most often that none is; what
  // the shell sent last is what shows once they are there
  let measuring: Promise<typeof import("./measureTools.ts")> | undefined;
  let latestTools: readonly MeasureTool[] = [];
  const showTools = (tools: readonly MeasureTool[]): void => {
    latestTools = tools;
    if (tools.length === 0 && measuring === undefined) return;
    measuring ??= import("./measureTools.ts");
    measuring
      .then(({ applyTools }) => applyTools(document, latestTools, catalogue.gridStep))
      .catch((error: unknown) => reportError(error instanceof Error ? error.message : String(error)));
  };
  // what shows the sheets of the values drawn, for a catalogue with any; set once the source's are placed
  let showValueSheets: ValueSheetsShower | undefined;
  // the view asked for while its sheets load: the next message is compared with it, or going back would stop short of
  // overtaking it, and the sheets would then draw a view the reader already left
  let askedView: LiveView | undefined;
  shell.listen((message: ShellMessage): void => {
    if (message.type === "forgebook:tools") showTools(message.tools);
    if (message.type === "forgebook:spills") showSpills(message.isOn);
    if (message.type !== "forgebook:view") return;
    const shown = withFixed(message.view, fixed);
    // the same view again draws nothing: a story's state, and the time its draw takes, are not the shell's to spend
    const latest = askedView ?? shownView;
    if (changeShown !== undefined && latest !== undefined && isSameLiveView(withFixed(latest, fixed), shown))
      return;
    askedView = message.view;
    const showLive = (): void => {
      applyView(document.documentElement, shown, catalogue);
      changeShown?.(message.view);
      shownView = changeShown === undefined ? undefined : message.view;
      askedView = undefined;
      const address = frameAddress(window.location.pathname, storyId, { ...view, ...message.view }, switches);
      window.history.replaceState(null, "", address);
    };
    // the root changes with the sheet that draws it; a later view overtakes this one
    if (showValueSheets === undefined) showLive();
    else {
      showValueSheets(shown.switches)
        .then((isLast) => {
          if (isLast) showLive();
        })
        .catch((error: unknown) => reportError(error instanceof Error ? error.message : String(error)));
    }
  });
  // until the story runs, or when it cannot, an edit of a file the frame loaded loads the page again: there is no story
  // drawn to renew in place, and a story file that failed to load keeps no other way to show its fix
  const reloadOnEdit = (event: Event): void => {
    event.preventDefault();
    window.location.reload();
  };
  let followStoryFile = reloadOnEdit;
  let followPreviews = reloadOnEdit;
  window.addEventListener(STORY_FILE_EVENT, (event: Event): void => followStoryFile(event));
  window.addEventListener(PREVIEWS_EVENT, (event: Event): void => followPreviews(event));
  const location = findStory(storyTree(config.sources), storyId);
  const source = config.sources.find((candidate) => candidate.id === location?.source.id);
  const load =
    location === undefined || source === undefined
      ? undefined
      : sourceFiles(source).stories[location.story.file];
  if (location === undefined || source === undefined || load === undefined) {
    fail(`No story "${storyId}"`);
    return;
  }
  try {
    // the Touch switch's simulation, on before the story's modules load, so a library that reads the device at once
    // sees touch
    await followTouch(document, reportError);
    await source.setup?.();
    await preview.setup?.();
    await loadSheets(document, viewSheets(source.sheets, view));
    showValueSheets = await valueSheetsShower(config.valueSheets, view.sheets, switches, reportError);
    await showValueSheets?.(view.switches);
    // the story file's exports: an edit of the file hands them on with its successor's
    let shownFile: unknown = await load();
    const first = readStory(shownFile, location.story.exportName, preview);
    if (typeof first === "string") {
      fail(first);
      return;
    }
    const plugins = startPluginFrames(config.plugins, storyId, tellShell);
    let story = first;
    fixed = fixedViewOf(story.globals, story.parameters, catalogue);
    await showValueSheets?.(withFixed(view, fixed).switches);
    applyView(document.documentElement, withFixed(view, fixed), catalogue);
    let controls: StoryControls | undefined;
    // why the story was not seen in its final state: a check of what it shows would pass on a fallback
    let pendingReason: string | undefined;
    const clock = storyFrameClock(story.clockStart, isClockHeldIn(window.location.search));
    shell.listen((message: ShellMessage): void => {
      if (controls !== undefined)
        answerShell(message, controls, storyId, pendingReason, catalogue.a11y, config.axeUrl, tellShell);
    });
    // the language's texts, and the switches the story reads (the language's provider reads its id among them); a
    // language the source gives as a loader is loaded as it is shown
    const shownFor = async (
      live: Pick<LiveView, "switches">
    ): Promise<Pick<StoryDrawing, "texts" | "globals">> => {
      const switchesShown = { switches: { ...live.switches, ...fixed.switches } };
      return {
        texts: await shownTexts(source.texts, shownLanguage(languages, languageOf(switchesShown, switches))),
        globals: { ...startingGlobals(preview, story), ...codeGlobalsOf(switchesShown, switches) }
      };
    };
    const shown = await shownFor(view);
    // the view the reader chose last: a language that loads slower than the next one chosen is never drawn
    let shownCount = 0;
    const { texts } = shown;
    // what the panel shows of the story; told again when an edit of its file changes it
    const tellReady = (): void => {
      // the panel shows a text an arg names as the story shows it, with its key beside it
      const args = panelArgsOf(withStoryTexts(story.args, storyTextOf(texts)), source.namedValues);
      tellShell({
        type: "forgebook:ready",
        storyId,
        canReplay: story.replay !== undefined,
        hasClock: story.clockStart !== undefined,
        args,
        textKeys: storyTextKeysOf(story.args),
        argTypes: panelArgTypesOf(story.argTypes, excludedControls(story.parameters["controls"])),
        controls: story.controls,
        actions: actionNames(story.args, story.argTypes),
        fixed,
        parameters: Object.keys(story.parameters)
      });
    };
    const running = runStory({
      container,
      story,
      identity: { id: storyId, name: location.story.name, title: location.component.title },
      ...playToolsOf(config),
      pluginSetups: plugins.setups,
      renderer: config.renderer,
      clock,
      // the first of the list is the innermost
      decorators: [...preview.decorators, ...plugins.decorators],
      ...shown,
      resolveArgs: (args: PanelArgs): Readonly<Record<string, unknown>> =>
        storyArgsOf(args, source.namedValues),
      onControlsReady: (next: StoryControls, outcome: StoryOutcome): void => {
        controls = next;
        clearRetry(sessionStorageOf(window), window.location.href);
        // the height first: the shell sizes the frame to the drawn story before anything reads it as ready, instead of
        // waiting on the resize observer, which may report after the ready status
        reportSize();
        reportScheme();
        pendingReason = showOutcome(outcome, storyId, story.suspense.isExpected);
        // the shell keeps an error it was told, and would read this as the story being fine again
        if (outcome.status !== "error") tellReady();
        changeShown = (live: LiveView): void => {
          shownCount += 1;
          const count = shownCount;
          shownFor(live)
            .then((next) => {
              if (count === shownCount) running.setShown(next);
            })
            .catch((error: unknown) => {
              // a language another choice replaced meanwhile is no longer the frame's concern
              if (count !== shownCount) return;
              // the story still shows the view before this one: choosing this one again must try again
              shownView = undefined;
              reportError(error instanceof Error ? error.message : String(error));
            });
        };
      },
      onError: (message: string, stack: string | undefined): void => reportError(message, stack),
      onTrace: (trace: PlayTrace): void => {
        tellShell({ type: "forgebook:play", storyId, trace });
        if (trace.status === "failed")
          tellDevServer({
            kind: "play",
            storyId,
            view: window.location.search,
            message: trace.error ?? "The play failed"
          });
      },
      onEvent: (name: string, values: readonly unknown[]): void =>
        tellShell({
          type: "forgebook:call",
          storyId,
          name,
          values: values.map(previewValue),
          details: values.map(detailOf)
        }),
      panelArgsOf: (values: Readonly<Record<string, unknown>>): PanelArgs =>
        panelArgsOf(values, source.namedValues),
      onArgsChange: (args: PanelArgs): void => tellShell({ type: "forgebook:story-args", storyId, args })
    });
    // an edit of the story file, or of a file it re-exports stories from, draws the story anew in place: the reader keeps
    // what they did in it. A story the edit took away leaves nothing to draw in place: the page loads again
    followStoryFile = (event: Event): void => {
      const succession = successionOf(event);
      if (succession === undefined || succession.previous !== shownFile) return;
      event.preventDefault();
      shownFile = succession.next;
      const next = readStory(succession.next, location.story.exportName, preview);
      if (typeof next === "string") {
        window.location.reload();
        return;
      }
      story = next;
      shownView = undefined;
      running.setStory(next);
      if (controls !== undefined) tellReady();
    };
    // an edit of a preview, or of a component it imports through a library's index, draws the story anew with the new
    // previews; the set-ups they run already ran, and stay as they were
    followPreviews = (event: Event): void => {
      const renewal = previewsRenewalOf(event);
      // the entry sends one module, or none, for each of its previews
      if (renewal === undefined || renewal.next.length !== previews.length) return;
      previews = previews.map((module, index) => renewal.next[index] ?? module);
      preview = mergedPreviews(previews.map(readPreview));
      const next = readStory(shownFile, location.story.exportName, preview);
      if (typeof next === "string") {
        window.location.reload();
        return;
      }
      story = next;
      shownView = undefined;
      running.setStory(next, [...preview.decorators, ...plugins.decorators]);
      if (controls !== undefined) tellReady();
    };
    // the shell opens another story by loading another page: the set-ups' cleanups run as this one goes (a page kept
    // for the back button keeps its story)
    window.addEventListener("pagehide", (event: PageTransitionEvent): void => {
      if (!event.persisted) running.leave();
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // a stale module (dependencies prepared again, a new build): one reload fetches the new one
    if (isStaleModuleError(message) && markRetry(sessionStorageOf(window), window.location.href)) {
      window.location.reload();
      return;
    }
    failedToLoad(message, fail);
  }
};
