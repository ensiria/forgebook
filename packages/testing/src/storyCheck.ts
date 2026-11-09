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
import type { StoryProblem, StoryWarning } from "forgebook/story-check";

import { findOverlaysPastFrame } from "./overlays.ts";

/** How Chromium's console begins the error for a file the page could not load, whose text names no file. */
const LOAD_FAILURE = "Failed to load resource";

/**
 * The kinds of request (Playwright's `resourceType`) that fetch a static file, drawn or applied as it is: never a module,
 * a script, a page or data the story's code reads.
 */
const STATIC_FILE_TYPES: ReadonlySet<string> = new Set([
  "image",
  "media",
  "font",
  "stylesheet",
  "texttrack",
  "manifest"
]);

/**
 * Whether a response is a static file that is not there: a story's missing image or font is a warning, not a failure,
 * since the story still runs and a person sees what is missing. A module, a script or data that answers 404 stops the
 * code that asked for it, and stays an error.
 *
 * @param resourceType - the request's kind, as Playwright names it.
 * @param status - the response's status.
 */
export const isMissingStaticFile = (resourceType: string, status: number): boolean =>
  status === 404 && STATIC_FILE_TYPES.has(resourceType);

/**
 * An address as a problem names it: its path and query, the same in every run whatever port the server took.
 *
 * @param address - the address; returned as it is when it is not one.
 */
const pathOf = (address: string): string => {
  try {
    const url = new URL(address);
    return `${url.pathname}${url.search}`;
  } catch {
    return address;
  }
};

/**
 * A console error as a problem reads it: a file the page could not load is named by its path, which the console gives
 * apart from the text, so the problem says which file it is.
 *
 * @param text - the console message's text.
 * @param location - the address the console gives for it; empty when none.
 */
export const consoleErrorText = (text: string, location: string): string =>
  !text.startsWith(LOAD_FAILURE) || location === "" ? text : `${text}: ${pathOf(location)}`;

/** An error the page raised, as it came: uncaught (`page`) or written to the console, with the address it names. */
export type PageError = {
  /** Where it came from. */
  readonly source: "page" | "console";
  /** Its text. */
  readonly text: string;
  /** The address the console gives for it; empty for an uncaught error or when none. */
  readonly location: string;
};

/** A page's errors, and the static files it asked for that are not there. */
export type PageFindings = {
  /** The errors that fail a story, in the order they came. */
  readonly errors: string[];
  /** The paths of the static files that answered 404, each once, in the order they came: warnings. */
  readonly missingFiles: string[];
};

/**
 * A page's errors split from its missing static files: the console's error for a file that is missing is the warning's,
 * and leaves the errors.
 *
 * @param errors - the errors, as they came.
 * @param missing - the addresses of the static files that answered 404, as they came.
 */
export const pageFindings = (errors: readonly PageError[], missing: readonly string[]): PageFindings => {
  const missingSet = new Set(missing);
  return {
    errors: errors
      .filter(
        (error) =>
          !(
            error.source === "console" &&
            error.text.startsWith(LOAD_FAILURE) &&
            missingSet.has(error.location)
          )
      )
      .map((error) =>
        error.source === "console" ? consoleErrorText(error.text, error.location) : error.text
      ),
    missingFiles: [...new Set(missing.map(pathOf))]
  };
};

/**
 * Watches a page from now on: its uncaught errors, its console's, and the static files it asks for that are not there.
 * Read once the story is shown, when every response has come, as the console may say a file failed before its response
 * is seen.
 *
 * @param page - the page, before it opens the story.
 * @returns what was found so far, each time it is called.
 */
export const watchedErrors = (page: Page): (() => PageFindings) => {
  const errors: PageError[] = [];
  const missing: string[] = [];
  page.on("pageerror", (error) => errors.push({ source: "page", text: error.message, location: "" }));
  page.on("console", (message) => {
    if (message.type() === "error")
      errors.push({ source: "console", text: message.text(), location: message.location().url });
  });
  page.on("response", (response) => {
    if (isMissingStaticFile(response.request().resourceType(), response.status()))
      missing.push(response.url());
  });
  return () => pageFindings(errors, missing);
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
 * @param findings - what `watchedErrors` found.
 */
export const errorProblems = (findings: PageFindings): StoryProblem[] =>
  findings.errors.map((message) => ({ kind: "error", message }));

/**
 * The page's missing static files as warnings, for a result: none when there are none, so a result without any keeps its
 * shape.
 *
 * @param findings - what `watchedErrors` found.
 */
export const missingFileWarnings = (findings: PageFindings): { warnings?: StoryWarning[] } =>
  findings.missingFiles.length === 0
    ? {}
    : {
        warnings: findings.missingFiles.map(
          (path): StoryWarning => ({
            kind: "missing-file",
            path,
            message: `${path} is not there (404): the story runs without it`
          })
        )
      };

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
