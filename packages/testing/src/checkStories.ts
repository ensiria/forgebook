/**
 * A story check run in a browser, as `forgebook check` asks for it: each story opened in each view asked for (or every
 * variant the browser tests check), the suite's checks run, the problems reported instead of failing.
 *
 * @remarks
 * The command loads this module from the project only when it runs, so the catalogue's core never needs a browser; it
 * hands a plain request in and reads a plain report back (`forgebook/story-check`). The stories are opened as the suite
 * opens them (`storyPages.ts`).
 *
 * @module
 */
import type { Page } from "@playwright/test";
import { type A11ySettings, catalogueSettings } from "forgebook/catalogue";
import { NOT_AWAITED_ATTRIBUTE } from "forgebook/frame-status";
import type {
  SemanticModel,
  StoryCheckReport,
  StoryCheckRequest,
  StoryCheckResult,
  StoryProblem
} from "forgebook/story-check";

import { isOverlayChecked } from "./overlays.ts";
import { askModel, storySight } from "./semanticJudge.ts";
import {
  axeProblems,
  errorProblems,
  focusProblems,
  isPageBlank,
  missingFileWarnings,
  overlayProblems,
  spillProblems,
  watchedErrors
} from "./storyCheck.ts";
import {
  couldNotBeShown,
  eachStoryPage,
  frameErrorOf,
  openedStory,
  pendingReasonOf,
  READY_MS,
  type StoryPage
} from "./storyPages.ts";
import { hasLookChecks } from "./storyTestPlan.ts";

/**
 * One story in one view, checked.
 *
 * @param page - a fresh page.
 * @param storyPage - the story and the view.
 * @param a11y - the catalogue's accessibility settings; none when it checks no accessibility (`a11y: false`).
 */
const checkedPage = async (
  page: Page,
  storyPage: StoryPage,
  a11y: A11ySettings | undefined,
  semantic: SemanticModel | undefined
): Promise<StoryCheckResult> => {
  const watched = watchedErrors(page);
  const status = await openedStory(page, storyPage);
  // read when the result is made: every response the page waited for has come by then
  const result = (problems: readonly StoryProblem[]): StoryCheckResult => ({
    storyId: storyPage.story.id,
    view: storyPage.name,
    frame: storyPage.frame,
    problems,
    ...missingFileWarnings(watched())
  });
  if (status === "silent")
    return result([
      { kind: "frame", message: `The frame did not say it was ready in ${READY_MS / 1000} s` },
      ...errorProblems(watched())
    ]);
  if (status === "error")
    return result([
      { kind: "frame", message: couldNotBeShown(await frameErrorOf(page), storyPage.story.file) },
      ...errorProblems(watched())
    ]);
  // what it shows now is not the story: a check of it would pass on a fallback, so none runs, and no pass is claimed
  if (status === "pending")
    return { ...result(errorProblems(watched())), notVerified: await pendingReasonOf(page) };
  // a story about logic gets the suite's checks of a scene, not those about looks (`storyTestPlan.ts`)
  const lookProblems = hasLookChecks(storyPage.story)
    ? [
        ...(await spillProblems(page)),
        // last of the page's checks: it resizes the window, which may close what the story left open
        ...(await overlayProblems(page, isOverlayChecked(storyPage.view), storyPage.story.height))
      ]
    : [];
  const axe = a11y === undefined ? [] : await axeProblems(page, a11y);
  const isNotAwaited = (await page.locator("html").getAttribute(NOT_AWAITED_ATTRIBUTE)) !== null;
  const isBlank = await page.evaluate(isPageBlank);
  const checked = {
    ...result([...axe, ...lookProblems, ...(await focusProblems(page)), ...errorProblems(watched())]),
    ...(isNotAwaited ? { isNotAwaited } : {}),
    ...(isBlank ? { isBlank } : {})
  };
  return semantic === undefined
    ? checked
    : { ...checked, judgements: await askModel(semantic, await storySight(page)) };
};

/**
 * Checks the stories a request names, in its views, on one browser.
 *
 * @param request - the stories, the views and the catalogue's settings.
 * @returns one result per story and view, in the request's order.
 */
export const checkStories = async (request: StoryCheckRequest): Promise<StoryCheckReport> => {
  const { a11y } = catalogueSettings("", request.switches, request.lists);
  const results = await eachStoryPage(request, (page, storyPage) =>
    checkedPage(page, storyPage, a11y, request.semantic)
  );
  return { schema: 1, results, ...(a11y === undefined ? { a11y: "off" } : {}) };
};
