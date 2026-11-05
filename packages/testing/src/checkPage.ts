/**
 * A real page of an application checked as a story is: accessibility, what spills, and its errors.
 *
 * @remarks
 * An agent verifies the screen it built, not only the stories behind it, so `forgebook check-page` opens any address.
 * Loaded from the project only when it runs, like `checkStories.ts`. No frame says this page is ready, so it counts as
 * ready when the network goes quiet, or after `QUIET_MS` for a page that keeps a connection open, which is checked as it
 * stands then. The report has a story check's shape, the address standing for the story's id.
 *
 * @module
 */
import { chromium, type Page } from "@playwright/test";
import { type A11ySettings, type CatalogueLists, catalogueSettings } from "forgebook/catalogue";
import type { StoryCheckReport, StoryCheckResult } from "forgebook/story-check";

import { axeProblems, errorProblems, focusProblems, spillProblems, watchedErrors } from "./storyCheck.ts";

/** How long a page gets for its network to go quiet, in milliseconds. */
const QUIET_MS = 10_000;

/** What a page check is asked. */
export type PageCheckRequest = {
  /** The pages' addresses. */
  readonly addresses: readonly string[];
  /** The catalogue's lists: its accessibility rules. */
  readonly lists: CatalogueLists;
};

/** One page, checked. */
const checkedPage = async (
  address: string,
  open: () => Promise<Page>,
  a11y: A11ySettings | undefined
): Promise<StoryCheckResult> => {
  const page = await open();
  const errors = watchedErrors(page);
  const result = (problems: StoryCheckResult["problems"]): StoryCheckResult => ({
    storyId: address,
    view: "",
    frame: address,
    problems
  });
  try {
    const response = await page.goto(address);
    await page.waitForLoadState("networkidle", { timeout: QUIET_MS }).catch(() => undefined);
    if (response !== null && !response.ok()) {
      return result([{ kind: "frame", message: `It answered ${response.status()}` }]);
    }
    return result([
      ...(a11y === undefined ? [] : await axeProblems(page, a11y)),
      ...(await spillProblems(page, "body")),
      ...(await focusProblems(page)),
      ...errorProblems(errors)
    ]);
  } catch (error) {
    return result([{ kind: "frame", message: error instanceof Error ? error.message : String(error) }]);
  } finally {
    await page.close();
  }
};

/**
 * Checks pages, on one browser.
 *
 * @param request - the addresses and the catalogue's settings.
 * @returns one result per page, in the request's order.
 */
export const checkPages = async ({ addresses, lists }: PageCheckRequest): Promise<StoryCheckReport> => {
  const { a11y } = catalogueSettings("", [], lists);
  const browser = await chromium.launch();
  try {
    // from a context of its own: axe opens pages of its own, which a bare `browser.newPage()` cannot share
    const context = await browser.newContext();
    const results: StoryCheckResult[] = [];
    for (const address of addresses) {
      results.push(await checkedPage(address, () => context.newPage(), a11y));
    }
    return { schema: 1, results, ...(a11y === undefined ? { a11y: "off" } : {}) };
  } finally {
    await browser.close();
  }
};
