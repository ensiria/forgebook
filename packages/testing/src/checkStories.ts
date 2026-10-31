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
import type {
  StoryCheckReport,
  StoryCheckRequest,
  StoryCheckResult,
  StoryProblem
} from "forgebook/story-check";

import { isOverlayChecked } from "./overlays.ts";
import { axeProblems, errorProblems, overlayProblems, spillProblems, watchedErrors } from "./storyCheck.ts";
import { eachStoryPage, openedStory, READY_MS, type StoryPage } from "./storyPages.ts";

/**
 * One story in one view, checked.
 *
 * @param page - a fresh page.
 * @param storyPage - the story and the view.
 * @param a11y - the catalogue's accessibility settings.
 */
const checkedPage = async (
  page: Page,
  storyPage: StoryPage,
  a11y: A11ySettings
): Promise<StoryCheckResult> => {
  const errors = watchedErrors(page);
  const status = await openedStory(page, storyPage);
  const result = (problems: readonly StoryProblem[]): StoryCheckResult => ({
    storyId: storyPage.story.id,
    view: storyPage.name,
    frame: storyPage.frame,
    problems
  });
  if (status === "silent")
    return result([
      { kind: "frame", message: `The frame did not say it was ready in ${READY_MS / 1000} s` },
      ...errorProblems(errors)
    ]);
  if (status === "error")
    return result([{ kind: "frame", message: "The story could not be shown" }, ...errorProblems(errors)]);
  return result([
    ...(await axeProblems(page, a11y)),
    ...(await spillProblems(page)),
    // last of the page's checks: it resizes the window, which may close what the story left open
    ...(await overlayProblems(page, isOverlayChecked(storyPage.view), storyPage.story.height)),
    ...errorProblems(errors)
  ]);
};

/**
 * Checks the stories a request names, in its views, on one browser.
 *
 * @param request - the stories, the views and the catalogue's settings.
 * @returns one result per story and view, in the request's order.
 */
export const checkStories = async (request: StoryCheckRequest): Promise<StoryCheckReport> => {
  const { a11y } = catalogueSettings("", request.switches, request.lists);
  const results = await eachStoryPage(request, (page, storyPage) => checkedPage(page, storyPage, a11y));
  return { schema: 1, results };
};
