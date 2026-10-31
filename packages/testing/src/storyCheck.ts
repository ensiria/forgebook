/**
 * The checks the catalogue's browser tests run on a story's frame, as problems instead of failures: axe with the
 * catalogue's rules, spills, overlays past the frame, and the page's errors. The suite (`browserTests.ts`) expects none;
 * `forgebook check` (`checkStories.ts`) reports them.
 *
 * @remarks
 * The messages are the suite's own, so a problem reads the same wherever it is found. A failed play is one of the
 * page's errors: its rejection reaches the page. The overlays check resizes the window, so it runs last of the page's
 * checks.
 *
 * @module
 */
import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import type { A11ySettings } from "forgebook/catalogue";
import { findSpills } from "forgebook/spills";
import type { StoryProblem } from "forgebook/story-check";

import { findOverlaysPastFrame } from "./overlays.ts";

/**
 * The page's errors from now on: uncaught ones and the console's, in the order they come.
 *
 * @param page - the page, before it opens the story.
 * @returns the list the errors are added to.
 */
export const watchedErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
};

/**
 * The rules of the catalogue's accessibility settings the story breaks.
 *
 * @param page - the story's frame page, ready.
 * @param a11y - the catalogue's accessibility settings.
 */
export const axeProblems = async (page: Page, a11y: A11ySettings): Promise<StoryProblem[]> => {
  const { violations } = await new AxeBuilder({ page })
    .withTags([...a11y.tags])
    .disableRules([...a11y.disabledRules])
    .analyze();
  return violations.map((violation) => ({
    kind: "axe",
    rule: violation.id,
    ...(violation.nodes[0] === undefined ? {} : { element: violation.nodes[0].target.join(" ") }),
    message: `${violation.id}: ${violation.help}`
  }));
};

/**
 * The elements that spill out of their parents.
 *
 * @param page - the story's frame page, ready.
 */
export const spillProblems = async (page: Page): Promise<StoryProblem[]> => {
  const spills = await page.evaluate(findSpills, ".forgebook-frame");
  return spills.map((spill) => ({
    kind: "spill",
    element: spill.element,
    message: `${spill.element} spills out of ${spill.parent} by ${spill.by}px`
  }));
};

/**
 * The overlays the story leaves open past its frame; none in a view where they are not checked.
 *
 * @param page - the story's frame page, its play over.
 * @param isChecked - whether the view checks overlays (`isOverlayChecked`).
 * @param sceneHeight - the height the story declares, in CSS px, if any.
 */
export const overlayProblems = async (
  page: Page,
  isChecked: boolean,
  sceneHeight: number | undefined
): Promise<StoryProblem[]> => {
  if (!isChecked) return [];
  const overlays = await findOverlaysPastFrame(page, sceneHeight);
  return overlays.map((overlay) => ({
    kind: "overlay",
    element: overlay.element,
    message: `${overlay.element} ends ${overlay.by}px below the frame's ${overlay.frameHeight}px: declare parameters.height`
  }));
};

/**
 * The page's errors as problems.
 *
 * @param errors - the errors `watchedErrors` collected.
 */
export const errorProblems = (errors: readonly string[]): StoryProblem[] =>
  errors.map((message) => ({ kind: "error", message }));
