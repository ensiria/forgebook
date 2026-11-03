/**
 * The entry of a story's frame: reads the story and the view from the address, loads the source's style sheets for
 * the view, then has the framework draw the story and, once its play function is over, tells the shell it is ready.
 *
 * @remarks
 * One document per story: the style sheets of the Styles setting, the switches on the root and anything the
 * story mounts on `body` stay in this document. The tests open the same address and wait for `data-forgebook-status`
 * on the root (`ready` or `error`), never for a delay. A Live story's clock runs from its start, or stays held there when
 * the address says so (`clock=held`, what the tests open). The framework is the renderer the framework package
 * passes (`renderer.ts`); nothing here depends on one.
 *
 * @module
 */
import "./frame.scss";

import type { StoryLanguage, StorySource } from "@forgebook/story-format/source";
import { storyTextOf } from "@forgebook/story-format/texts";

import { actionNames, excludedControls, panelArgTypesOf } from "../argTypes.ts";
import { type A11ySettings, type CatalogueLists, catalogueSettings } from "../catalogue.ts";
import { type FramesPlacement, SAME_ORIGIN } from "../frameOrigins.ts";
import { PREVIEWS_EVENT, previewsRenewalOf, STORY_FILE_EVENT, successionOf } from "../hotModules.ts";
import { shownLanguage } from "../languages.ts";
import { LIVE_ERROR_EVENT, type LiveErrorReport } from "../liveErrors.ts";
import { detailOf, type PanelArgs, previewValue, type ShellMessage } from "../messages.ts";
import { panelArgsOf, storyArgsOf } from "../namedValues.ts";
import type { PlayTrace } from "../playTrace.ts";
import { applySafeArea } from "../safeAreaParameter.ts";
import { sourceFiles } from "../sourceFiles.ts";
import { isClockHeldIn } from "../storyClock.ts";
import { type FixedView, fixedViewOf, NOT_FIXED, withFixed } from "../storyGlobals.ts";
import { shownTexts, storyTextKeysOf, withStoryTexts } from "../storyTexts.ts";
import { findStory, storyTree } from "../storyTree.ts";
import { catalogueSwitches, type ViewSwitch } from "../switches.ts";
import {
  codeGlobalsOf,
  frameAddress,
  type LiveView,
  languageOf,
  type MeasureTool,
  parseView
} from "../viewState.ts";
import { checkStory } from "./checkStory.ts";
import { followTouch } from "./followTouch.ts";
import { storyFrameClock } from "./frameClock.ts";
import { FRAME_STARTED_ATTRIBUTE, STATUS_ATTRIBUTE } from "./frameStatus.ts";
import { applyView, loadSheets, viewSheets } from "./frameView.ts";
import type { PlayToolsLoader } from "./playStory.ts";
import { type FramePlugin, startPluginFrames } from "./pluginFrames.ts";
import type { StoryDrawing, StoryRenderer } from "./renderer.ts";
import { type ShellChannel, shellChannel } from "./shellChannel.ts";
import { spillOutline } from "./spillOutline.ts";
import { clearRetry, isStaleModuleError, markRetry, sessionStorageOf } from "./staleModule.ts";
import { mergedPreviews, readPreview, readStory, startingGlobals } from "./storyModule.ts";
import { runStory, type StoryControls, type StoryRunOptions } from "./storyRun.ts";

/** What an app passes to the frame. */
export type FrameConfig = {
  /** The framework that draws the stories (`@forgebook/react` passes its own). */
  readonly renderer: StoryRenderer;
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

// a story that threw is gone from its frame, so a hot update has nothing to update: the fix shows only in a new page
import.meta.hot?.on("vite:afterUpdate", (): void => {
  if (document.documentElement.getAttribute(STATUS_ATTRIBUTE) === "error") window.location.reload();
});

/**
 * Does what a message of the shell asks of the rendered story; the view's live part is applied apart, before the story
 * loads.
 *
 * @param message - the message.
 * @param controls - the rendered story's controls.
 * @param storyId - the story's id, for the answers.
 * @param rules - the catalogue's accessibility rules, for a check.
 * @param axeUrl - the address of axe's script, for a check.
 * @param tellShell - tells the shell the check's result.
 */
const answerShell = (
  message: ShellMessage,
  controls: StoryControls,
  storyId: string,
  rules: A11ySettings,
  axeUrl: string | undefined,
  tellShell: ShellChannel["tell"]
): void => {
  if (message.type === "forgebook:replay") void controls.replay();
  else if (message.type === "forgebook:args") controls.setPanelArgs(message.args);
  else if (message.type === "forgebook:events") controls.setEvents(message.names);
  else if (message.type === "forgebook:matrix") controls.setMatrix(message.matrix ?? undefined);
  else if (message.type === "forgebook:play-again") controls.playAgain();
  else if (message.type === "forgebook:clock") controls.setClock(message.state);
  else if (message.type === "forgebook:clock-restart") controls.restartClock();
  else if (message.type === "forgebook:check") {
    checkStory(document, rules, axeUrl)
      .then((violations) => tellShell({ type: "forgebook:checked", storyId, violations }))
      .catch((error: unknown) =>
        tellShell({
          type: "forgebook:check-error",
          storyId,
          message: error instanceof Error ? error.message : String(error)
        })
      );
  }
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
  const reportError = (message: string): void => {
    document.documentElement.setAttribute(STATUS_ATTRIBUTE, "error");
    tellShell({ type: "forgebook:error", storyId, message });
    tellDevServer({ kind: "render", storyId, view: window.location.search, message });
  };
  const fail = (message: string): void => {
    const box = document.createElement("div");
    box.className = "forgebook-frame-error";
    box.setAttribute("role", "alert");
    const text = document.createElement("p");
    text.className = "forgebook-frame-error__message";
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
  shell.listen((message: ShellMessage): void => {
    if (message.type === "forgebook:tools") showTools(message.tools);
    if (message.type === "forgebook:spills") showSpills(message.isOn);
    if (message.type !== "forgebook:view") return;
    applyView(document.documentElement, withFixed(message.view, fixed), catalogue);
    changeShown?.(message.view);
    const address = frameAddress(window.location.pathname, storyId, { ...view, ...message.view }, switches);
    window.history.replaceState(null, "", address);
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
    applyView(document.documentElement, withFixed(view, fixed), catalogue);
    let controls: StoryControls | undefined;
    const clock = storyFrameClock(story.clockStart, isClockHeldIn(window.location.search));
    shell.listen((message: ShellMessage): void => {
      if (controls !== undefined)
        answerShell(message, controls, storyId, catalogue.a11y, config.axeUrl, tellShell);
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
      onControlsReady: (next: StoryControls): void => {
        controls = next;
        clearRetry(sessionStorageOf(window), window.location.href);
        // the height first: the shell sizes the frame to the drawn story before anything reads it as ready, instead of
        // waiting on the resize observer, which may report after the ready status
        reportSize();
        document.documentElement.setAttribute(STATUS_ATTRIBUTE, "ready");
        tellReady();
        changeShown = (live: LiveView): void => {
          shownCount += 1;
          const count = shownCount;
          shownFor(live)
            .then((next) => {
              if (count === shownCount) running.setShown(next);
            })
            .catch((error: unknown) => {
              // a language another choice replaced meanwhile is no longer the frame's concern
              if (count === shownCount) reportError(error instanceof Error ? error.message : String(error));
            });
        };
      },
      onError: reportError,
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
        })
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
    fail(message);
  }
};
