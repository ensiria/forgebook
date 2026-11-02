/**
 * The stories a check or a picture run asks for, opened as the catalogue's browser tests open them: each story in each
 * view (or every variant the tests check), its clock held, on its page's own colour, the window as wide as the view's
 * width (a device's viewport when the view names one), one browser for the run and a context of its own per page.
 *
 * @remarks
 * Shared by `checkStories.ts` and `shotStories.ts`, which `forgebook check` and `forgebook shot` load from the project.
 * A frame that never says it is ready is told apart from one that says it failed, so a story stuck loading is never
 * taken for one that passed.
 *
 * @module
 */
import { chromium, type Page } from "@playwright/test";
import { catalogueSettings } from "forgebook/catalogue";
import { deviceViewport, type NamedDevice, namedDevice } from "forgebook/device-picture";
import { STATUS_ATTRIBUTE } from "forgebook/frame-status";
import type { StoryCheckRequest, StoryCheckStory } from "forgebook/story-check";
import { heldClockAddress } from "forgebook/story-clock";
import { defaultView, frameAddress, parseView, type ViewState } from "forgebook/view-state";

import { storyVariants } from "./browserTests.ts";
import { LOGIC_VARIANT } from "./storyTestPlan.ts";

/** The window's size when a view sets no width, in CSS px: the browser tests' own. */
const WINDOW = { width: 1280, height: 800 };

/** How long a frame may take to say it is ready, in ms. */
export const READY_MS = 30_000;

/** One story in one view: what to open and how. */
export type StoryPage = {
  /** The story. */
  readonly story: StoryCheckStory;
  /** The view's name in the report: as asked, or the variant's. */
  readonly name: string;
  /** The view, on the page's own colour. */
  readonly view: ViewState;
  /** The window's width, when the view sets one. */
  readonly width: number | undefined;
  /**
   * The device the view names (`device=iphone-16`): the window takes its viewport and the picture its frame. A
   * story's own default device never counts, so the tests and the pictures stay unframed unless asked.
   */
  readonly device: NamedDevice | undefined;
  /** The frame's address in that view, its clock held. */
  readonly frame: string;
};

/** What a frame said once opened: ready, failed, or nothing in time. */
export type FrameStatus = "ready" | "error" | "silent";

/**
 * The views a request names: every variant of the browser tests, or each view given (the default view without any).
 *
 * @param request - the request.
 */
const viewsOf = (
  request: StoryCheckRequest
): { readonly name: string; readonly view: ViewState; readonly width: number | undefined }[] => {
  const catalogue = catalogueSettings("", request.switches, request.lists);
  const defaults = defaultView(catalogue);
  if (request.isAllVariants)
    return storyVariants(request.switches).map((variant) => ({
      name: variant.name,
      view: { ...defaults, ...variant.view, switches: { ...defaults.switches, ...variant.view.switches } },
      width: variant.width
    }));
  const queries = request.views.length === 0 ? [""] : request.views;
  return queries.map((query) => {
    const view = parseView(query, catalogue);
    return { name: query, view, width: view.width === "fill" ? undefined : view.width };
  });
};

/**
 * Every story in every view a request names, in its order.
 *
 * @param request - the request.
 */
export const storyPagesOf = (request: StoryCheckRequest): StoryPage[] => {
  const views = viewsOf(request);
  const catalogue = catalogueSettings("", request.switches, request.lists);
  // a story about logic has one look worth checking: every variant is its default view (`storyTestPlan.ts`)
  const logicViews = request.isAllVariants
    ? [{ name: LOGIC_VARIANT.name, view: defaultView(catalogue), width: undefined }]
    : views;
  return request.stories.flatMap((story) =>
    (story.isLogic === true ? logicViews : views).map(({ name, view, width }) => {
      const shown: ViewState = { ...view, backdrop: "plain" };
      return {
        story,
        name,
        view: shown,
        width,
        device: namedDevice(view),
        frame: heldClockAddress(frameAddress(request.frameUrl, story.id, shown, request.switches))
      };
    })
  );
};

/**
 * Opens a story's frame in its window and waits until it says it is ready or that it failed.
 *
 * @param page - a fresh page.
 * @param storyPage - the story and the view.
 */
export const openedStory = async (page: Page, storyPage: StoryPage): Promise<FrameStatus> => {
  const screen = storyPage.device === undefined ? undefined : deviceViewport(storyPage.device);
  await page.setViewportSize(
    screen === undefined
      ? { width: storyPage.width ?? WINDOW.width, height: WINDOW.height }
      : { width: screen.width, height: screen.height }
  );
  await page.goto(storyPage.frame);
  try {
    await page.waitForFunction(
      (attribute) => ["ready", "error"].includes(document.documentElement.getAttribute(attribute) ?? ""),
      STATUS_ATTRIBUTE,
      { timeout: READY_MS }
    );
  } catch {
    return "silent";
  }
  return (await page.locator("html").getAttribute(STATUS_ATTRIBUTE)) === "ready" ? "ready" : "error";
};

/**
 * Visits every story page of a request on one browser, each on a page in a context of its own (axe asks for one, and no
 * story's storage reaches the next).
 *
 * @param request - the request.
 * @param visit - what to do on each: its answer is collected.
 * @returns the answers, in the request's order.
 */
export const eachStoryPage = async <TResult>(
  request: StoryCheckRequest,
  visit: (page: Page, storyPage: StoryPage) => Promise<TResult>
): Promise<TResult[]> => {
  const browser = await chromium.launch();
  try {
    const answers: TResult[] = [];
    for (const storyPage of storyPagesOf(request)) {
      const context = await browser.newContext();
      try {
        answers.push(await visit(await context.newPage(), storyPage));
      } finally {
        await context.close();
      }
    }
    return answers;
  } finally {
    await browser.close();
  }
};
