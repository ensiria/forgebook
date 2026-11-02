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
import { PREVIEWS_EVENT, previewsRenewalOf, STORY_FILE_EVENT, successionOf } from "../hotModules.ts";
import { shownLanguage } from "../languages.ts";
import { LIVE_ERROR_EVENT, type LiveErrorReport } from "../liveErrors.ts";
import {
  detailOf,
  type FrameMessage,
  isShellMessage,
  type PanelArgs,
  previewValue,
  type ShellMessage
} from "../messages.ts";
import { panelArgsOf, storyArgsOf } from "../namedValues.ts";
import type { PlayTrace } from "../playTrace.ts";
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
import type { FrameRenderer, StoryDrawing } from "./renderer.ts";
import { spillOutline } from "./spillOutline.ts";
import { clearRetry, isStaleModuleError, markRetry, sessionStorageOf } from "./staleModule.ts";
import { mergedPreviews, readPreview, readStory } from "./storyModule.ts";
import { runStory, type StoryControls, type StoryRunOptions } from "./storyRun.ts";

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
  /** The catalogue's lists (its backgrounds, text sizes, grid step, accessibility rules…); the defaults when none. */
  readonly lists?: CatalogueLists;
  /** Loads the play tools, when the project installs Testing Library (the generated frame passes it then). */
  readonly playTools?: PlayToolsLoader;
  /** The plugins with a frame module (the generated frame passes them); none by default. */
  readonly plugins?: readonly FramePlugin[];
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

/** Tells the shell, which is the parent page on the same origin. */
const tellShell = (message: FrameMessage): void => {
  if (window.parent !== window) window.parent.postMessage(message, window.location.origin);
};

/**
 * Does what a message of the shell asks of the rendered story; the view's live part is applied apart, before the story
 * loads.
 *
 * @param message - the message.
 * @param controls - the rendered story's controls.
 * @param storyId - the story's id, for the answers.
 * @param rules - the catalogue's accessibility rules, for a check.
 * @param axeUrl - the address of axe's script, for a check.
 */
const answerShell = (
  message: ShellMessage,
  controls: StoryControls,
  storyId: string,
  rules: A11ySettings,
  axeUrl: string | undefined
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
  applyView(document.documentElement, view, catalogue);
  // the Touch switch's simulation, on before the story's modules load, so a library that reads the device at once
  // sees touch
  await followTouch(document);
  // what the story fixes of the view, once it is read: every view the frame applies has it over the shell's
  let fixed: FixedView = NOT_FIXED;
  // set once the story runs: a view the shell sends then changes its language and its globals without a new mount
  let changeShown: ((live: LiveView) => void) | undefined;
  // the shell sends the live part of a changed view: applied on the root, and kept in the address so a reload (an
  // edit, a stale module) shows the same view
  const showSpills = spillOutline(document, ".forgebook-frame", (count) =>
    tellShell({ type: "forgebook:spills", storyId, count })
  );
  // the measuring tools load when one is first turned on: the shell tells every frame, most often that none is
  let hasTools = false;
  const showTools = async (tools: readonly MeasureTool[]): Promise<void> => {
    if (tools.length === 0 && !hasTools) return;
    hasTools = true;
    const { applyTools } = await import("./measureTools.ts");
    applyTools(document, tools, catalogue.gridStep);
  };
  window.addEventListener("message", (event: MessageEvent): void => {
    if (event.origin !== window.location.origin || !isShellMessage(event.data)) return;
    if (event.data.type === "forgebook:tools") void showTools(event.data.tools);
    if (event.data.type === "forgebook:spills") showSpills(event.data.isOn);
    if (event.data.type !== "forgebook:view") return;
    applyView(document.documentElement, withFixed(event.data.view, fixed), catalogue);
    changeShown?.(event.data.view);
    const address = frameAddress(
      window.location.pathname,
      storyId,
      { ...view, ...event.data.view },
      switches
    );
    window.history.replaceState(null, "", address);
  });
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

  const location = findStory(storyTree(config.sources), storyId);
  const source = config.sources.find((candidate) => candidate.id === location?.source.id);
  const load =
    location === undefined || source === undefined
      ? undefined
      : sourceFiles(source).stories[location.component.file];
  if (location === undefined || source === undefined || load === undefined) {
    fail(`No story "${storyId}"`);
    return;
  }
  try {
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
    let story = first;
    const plugins = startPluginFrames(config.plugins ?? [], storyId, tellShell);
    fixed = fixedViewOf(story.globals, story.parameters, catalogue);
    applyView(document.documentElement, withFixed(view, fixed), catalogue);
    let controls: StoryControls | undefined;
    const clock = storyFrameClock(story.clockStart, isClockHeldIn(window.location.search));
    window.addEventListener("message", (event: MessageEvent): void => {
      if (event.origin !== window.location.origin || !isShellMessage(event.data)) return;
      if (controls !== undefined) answerShell(event.data, controls, storyId, catalogue.a11y, config.axeUrl);
    });
    // the language's texts, and the switches the story reads (the language's provider reads its id among them)
    // (a language the source gives as a loader is loaded as it is shown)
    const shownFor = async (
      live: Pick<LiveView, "switches">
    ): Promise<Pick<StoryDrawing, "texts" | "globals">> => {
      const switchesShown = { switches: { ...live.switches, ...fixed.switches } };
      return {
        texts: await shownTexts(source.texts, shownLanguage(languages, languageOf(switchesShown, switches))),
        globals: { ...preview.globals, ...codeGlobalsOf(switchesShown, switches) }
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
            .catch((error: unknown) => reportError(error instanceof Error ? error.message : String(error)));
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
    window.addEventListener(STORY_FILE_EVENT, (event: Event): void => {
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
    });
    // an edit of a preview, or of a component it imports through a library's index, draws the story anew with the new
    // previews; the set-ups they run already ran, and stay as they were
    window.addEventListener(PREVIEWS_EVENT, (event: Event): void => {
      const renewal = previewsRenewalOf(event);
      if (renewal === undefined) return;
      previews = previews.map((module, index) => renewal.next[index] ?? module);
      preview = mergedPreviews(previews.map(readPreview));
      const next = readStory(shownFile, location.story.exportName, preview);
      if (typeof next === "string") {
        window.location.reload();
        return;
      }
      story = next;
      running.setStory(next, [...preview.decorators, ...plugins.decorators]);
    });
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
