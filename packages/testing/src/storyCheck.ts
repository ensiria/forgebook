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
 * @param root - the element to look inside; a story's frame by default.
 */
export const spillProblems = async (page: Page, root = ".forgebook-frame"): Promise<StoryProblem[]> => {
  const spills = await page.evaluate(findSpills, root);
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

/** A modal, in a document: what a keyboard has to stay inside of. */
const MODAL = 'dialog[open], [role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]';

/** Whether the focus is inside the modal, as the page sees it. */
const isFocusInside = (page: Page): Promise<boolean> =>
  page.evaluate(
    (selector) => document.querySelector(selector)?.contains(document.activeElement) === true,
    MODAL
  );

/**
 * Whether the focus reached the page behind the modal. On `body` it is not: a native modal lets Tab go on to the browser's
 * own controls, which is how it works, and the page behind stays out of reach.
 */
const isFocusBehind = (page: Page): Promise<boolean> =>
  page.evaluate((selector) => {
    const active = document.activeElement;
    return active !== document.body && document.querySelector(selector)?.contains(active) === false;
  }, MODAL);

/**
 * What a modal does wrong with the keyboard: what an axe run and a screenshot do not show. It moves the focus inside when
 * it opens, and Tab stays inside. Last of a page's checks, since it presses keys.
 *
 * @param page - the page, ready; a page with no open modal has nothing to check.
 */
export const focusProblems = async (page: Page): Promise<StoryProblem[]> => {
  const stops = await page.evaluate(
    (selector) =>
      document
        .querySelector(selector)
        ?.querySelectorAll("a[href], button, input, select, textarea, [tabindex]").length,
    MODAL
  );
  if (stops === undefined) return [];
  if (stops === 0) {
    return [
      { kind: "focus", message: "The modal holds nothing to focus: a keyboard cannot reach it or leave it" }
    ];
  }
  if (!(await isFocusInside(page))) {
    return [{ kind: "focus", message: "The modal did not move the focus inside when it opened" }];
  }
  for (let press = 0; press <= stops; press += 1) {
    await page.keyboard.press("Tab");
    if (await isFocusBehind(page)) {
      return [
        { kind: "focus", message: "Tab leaves the modal: the focus has to stay inside while it is open" }
      ];
    }
  }
  return [];
};

/**
 * The page's errors as problems.
 *
 * @param errors - the errors `watchedErrors` collected.
 */
export const errorProblems = (errors: readonly string[]): StoryProblem[] =>
  errors.map((message) => ({ kind: "error", message }));

/**
 * Whether a story's page shows nothing a reader could see: no text, and no element with a size that shows something of its
 * own. Runs in the page, so it holds all it reads.
 *
 * @returns whether it is blank.
 */
export const isPageBlank = (): boolean => {
  const notContent = "script, style, link, meta, template, noscript, head";
  const replaced = "svg, canvas, img, video, iframe, input, button, select, textarea, hr, progress, meter";
  return ![...document.body.querySelectorAll("*")].some((element) => {
    if (element.closest(notContent) !== null) return false;
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return false;
    const hasOwnText = [...element.childNodes].some(
      (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== ""
    );
    if (hasOwnText || element.matches(replaced)) return true;
    const look = getComputedStyle(element);
    return (
      look.backgroundImage !== "none" ||
      !/^(?:transparent|rgba\(0, 0, 0, 0\))$/.test(look.backgroundColor) ||
      Number.parseFloat(look.borderTopWidth) > 0 ||
      Number.parseFloat(look.borderBottomWidth) > 0
    );
  });
};
