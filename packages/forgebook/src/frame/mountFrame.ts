/**
 * The entry of a story's frame: reads the story and the view from the address, loads the source's style sheets for
 * the view, then has the framework draw the story and, once its play function is over, tells the shell it is ready.
 *
 * @remarks
 * One document per story (D-56): the style sheets of the Styles setting, the switches on the root and anything the
 * story mounts on `body` stay in this document. The tests open the same address and wait for `data-forgebook-status`
 * on the root (`ready` or `error`), never for a delay. A Live story's clock runs from its start, or stays held there when
 * the address says so (`clock=held`, what the tests open; D-504). The framework is the renderer the framework package
 * passes (`renderer.ts`); nothing here depends on one.
 *
 * @module
 */
import "./frame.scss";

import type { StoryLanguage, StorySource } from "@forgebook/story-format/source";
import { storyTextOf } from "@forgebook/story-format/texts";

import { shownLanguage, storyLanguages } from "../languages";
import {
  detailOf,
  type FrameMessage,
  isShellMessage,
  type PanelArgs,
  previewValue,
  type ShellMessage
} from "../messages";
import { panelArgsOf, storyArgsOf } from "../namedValues";
import type { PlayTrace } from "../playTrace";
import { sourceFiles } from "../sourceFiles";
import { isClockHeldIn } from "../storyClock";
import { shownTexts, storyTextKeysOf, withStoryTexts } from "../storyTexts";
import { findStory, storyTree } from "../storyTree";
import { catalogueSwitches, type ViewSwitch } from "../switches";
import { codeGlobalsOf, frameAddress, type LiveView, languageOf, parseView } from "../viewState";
import { checkStory } from "./checkStory";
import { storyFrameClock } from "./frameClock";
import { STATUS_ATTRIBUTE } from "./frameStatus";
import { applyView, loadSheets, viewSheets } from "./frameView";
import { applyTools } from "./measureTools";
import type { StoryDrawing, StoryRenderer } from "./renderer";
import { clearRetry, isStaleModuleError, markRetry, sessionStorageOf } from "./staleModule";
import { readStory } from "./storyModule";
import { runStory, type StoryControls } from "./storyRun";

/** What an app passes to the frame. */
export type FrameConfig = {
  /** The framework that draws the stories (`@forgebook/react` passes its own). */
  readonly renderer: StoryRenderer;
  /** The sources the shell shows, in the same order. */
  readonly sources: readonly StorySource[];
  /** The languages every story can be drawn in, as the shell's configuration gives them; none turns them off. */
  readonly languages?: readonly StoryLanguage[];
  /** The switches of the toolbar and the View menu, as the shell's configuration gives them; the theme and contrast by default. */
  readonly switches?: readonly ViewSwitch[];
};

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
 */
const answerShell = (message: ShellMessage, controls: StoryControls, storyId: string): void => {
  if (message.type === "forgebook:replay") void controls.replay();
  else if (message.type === "forgebook:args") controls.setPanelArgs(message.args);
  else if (message.type === "forgebook:events") controls.setEvents(message.names);
  else if (message.type === "forgebook:matrix") controls.setMatrix(message.matrix ?? undefined);
  else if (message.type === "forgebook:play-again") controls.playAgain();
  else if (message.type === "forgebook:clock") controls.setClock(message.state);
  else if (message.type === "forgebook:clock-restart") controls.restartClock();
  else if (message.type === "forgebook:check") {
    checkStory(document)
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

/**
 * Shows the story the address names in the given element.
 *
 * @param container - the element the story renders into.
 * @param config - the sources.
 */
export const mountFrame = async (container: HTMLElement, config: FrameConfig): Promise<void> => {
  const params = new URLSearchParams(window.location.search);
  const storyId = params.get("story") ?? "";
  const switches = catalogueSwitches(config.switches, [
    ...(config.languages ?? []),
    ...config.sources.flatMap((each) => each.languages ?? [])
  ]);
  const view = parseView(window.location.search, switches);
  applyView(document.documentElement, view, switches);
  // set once the story runs: a view the shell sends then changes its language and its globals without a new mount
  let changeShown: ((live: LiveView) => void) | undefined;
  // the shell sends the live part of a changed view: applied on the root, and kept in the address so a reload (an
  // edit, a stale module) shows the same view
  window.addEventListener("message", (event: MessageEvent): void => {
    if (event.origin !== window.location.origin || !isShellMessage(event.data)) return;
    if (event.data.type === "forgebook:tools") applyTools(document, event.data.tools);
    if (event.data.type !== "forgebook:view") return;
    applyView(document.documentElement, event.data.view, switches);
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
    await loadSheets(document, viewSheets(source.sheets, view));
    const story = readStory(await load(), location.story.exportName);
    if (typeof story === "string") {
      fail(story);
      return;
    }
    let controls: StoryControls | undefined;
    const clock = storyFrameClock(story.clockStart, isClockHeldIn(window.location.search));
    const languages = storyLanguages(config.languages ?? [], source.languages ?? []);
    window.addEventListener("message", (event: MessageEvent): void => {
      if (event.origin !== window.location.origin || !isShellMessage(event.data)) return;
      if (controls !== undefined) answerShell(event.data, controls, storyId);
    });
    // the language's texts and provider, and the switches the story reads, for a view
    const shownFor = (live: Pick<LiveView, "switches">): Pick<StoryDrawing, "texts" | "wrap" | "globals"> => {
      const language = shownLanguage(languages, languageOf(live, switches));
      return {
        texts: shownTexts(source.texts, language),
        wrap: language?.wrap,
        globals: codeGlobalsOf(live, switches)
      };
    };
    const shown = shownFor(view);
    const { texts } = shown;
    const running = runStory({
      container,
      story,
      renderer: config.renderer,
      clock,
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
        // the panel shows a text an arg names as the story shows it, with its key beside it
        const args = panelArgsOf(withStoryTexts(story.args, storyTextOf(texts)), source.namedValues);
        const textKeys = storyTextKeysOf(story.args);
        tellShell({
          type: "forgebook:ready",
          storyId,
          canReplay: story.replay !== undefined,
          hasClock: story.clockStart !== undefined,
          args,
          textKeys
        });
        changeShown = (live: LiveView): void => running.setShown(shownFor(live));
      },
      onError: reportError,
      onTrace: (trace: PlayTrace): void => tellShell({ type: "forgebook:play", storyId, trace }),
      onEvent: (name: string, values: readonly unknown[]): void =>
        tellShell({
          type: "forgebook:call",
          storyId,
          name,
          values: values.map(previewValue),
          details: values.map(detailOf)
        })
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
