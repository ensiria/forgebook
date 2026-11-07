/**
 * The app's pages after a change, as a person would see them: each state the task names reached by its steps,
 * pictured and checked with axe, and each acceptance check run.
 *
 * @remarks
 * Axe is the copy Forgebook's own checks run, read from the measurement copy's install, so both arms are checked by
 * one version and the harness adds no dependency. A state that cannot be reached is a finding, not a crash: the picture
 * is left out and the reason kept.
 *
 * @module
 */
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import type { Browser, Page, Locator as PageLocator } from "@playwright/test";

import type { Acceptance, Locator, PageState, StateMeasure, Step, Viewport } from "./eval.types.ts";

/** How long one step may take, in milliseconds. */
const STEP_TIMEOUT = 15_000;

/** The windows a state is shown in, in CSS px. */
const VIEWPORTS: Readonly<Record<Viewport, { readonly width: number; readonly height: number }>> = {
  desktop: { width: 1280, height: 800 },
  narrow: { width: 360, height: 780 }
};

/**
 * An element on the page, as a step names it: the first one a person can see, since a name or a text is often also in
 * something hidden (an icon's `<title>`, a closed menu).
 */
const located = (page: Page, locator: Locator): PageLocator => {
  const found = (() => {
    if ("role" in locator)
      return page.getByRole(
        locator.role,
        locator.name === undefined ? {} : { name: locator.name, exact: true }
      );
    if ("label" in locator) return page.getByLabel(locator.label, { exact: true });
    if ("placeholder" in locator) return page.getByPlaceholder(locator.placeholder, { exact: true });
    return page.getByText(locator.text);
  })();
  return found.filter({ visible: true }).first();
};

/**
 * Takes one step.
 *
 * @param page - the page.
 * @param step - the step.
 * @param origin - the app's address, which `goto` paths are read from.
 */
const takeStep = async (page: Page, step: Step, origin: string): Promise<void> => {
  if ("goto" in step) {
    await page.goto(`${origin}${step.goto}`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: STEP_TIMEOUT }).catch(() => undefined);
  } else if ("click" in step) await located(page, step.click).click();
  else if ("fill" in step) await located(page, step.fill).fill(step.value);
  else if ("press" in step) await page.keyboard.press(step.press);
  else if ("expectVisible" in step) await located(page, step.expectVisible).waitFor({ state: "visible" });
  else if ("expectHidden" in step) await located(page, step.expectHidden).waitFor({ state: "hidden" });
  else {
    const actual = await located(page, step.expectValue).inputValue();
    if (actual !== step.value) throw new Error(`expected the value "${step.value}", found "${actual}"`);
  }
};

/** Axe's violations from its result, by rule id, with how many nodes each. */
export const violationCounts = (result: unknown): Record<string, number> => {
  const counts: Record<string, number> = {};
  if (typeof result !== "object" || result === null || !("violations" in result)) return counts;
  const { violations } = result;
  if (!Array.isArray(violations)) return counts;
  for (const violation of violations) {
    if (typeof violation !== "object" || violation === null) continue;
    const id = "id" in violation && typeof violation.id === "string" ? violation.id : "unknown";
    const nodes = "nodes" in violation && Array.isArray(violation.nodes) ? violation.nodes.length : 1;
    counts[id] = (counts[id] ?? 0) + nodes;
  }
  return counts;
};

/** The page's error, in one line. */
const reason = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? "unknown error";

/** What `runPages` needs. */
export type PagesRequest = {
  /** The browser. */
  readonly browser: Browser;
  /** The app's address, without a trailing slash. */
  readonly origin: string;
  /** The measurement copy's folder, whose Forgebook install holds axe. */
  readonly folder: string;
  /** The states. */
  readonly states: readonly PageState[];
  /** The acceptance checks. */
  readonly acceptance: readonly Acceptance[];
  /** Where pictures go. */
  readonly pictures: string;
};

/** What `runPages` found. */
export type PagesResult = {
  /** Each state. */
  readonly states: readonly StateMeasure[];
  /** Each acceptance check. */
  readonly acceptance: readonly {
    readonly name: string;
    readonly isPassed: boolean;
    readonly error?: string;
  }[];
};

/** Runs steps in a fresh page of a fresh context. */
const inFreshPage = async <TResult>(
  request: PagesRequest,
  options: { readonly viewport: Viewport; readonly scheme: "light" | "dark" },
  work: (page: Page) => Promise<TResult>
): Promise<TResult> => {
  const context = await request.browser.newContext({
    viewport: VIEWPORTS[options.viewport],
    colorScheme: options.scheme,
    reducedMotion: "reduce"
  });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(STEP_TIMEOUT);
    return await work(page);
  } finally {
    await context.close();
  }
};

/** How long a warmed page is left to finish what it loads after the network went quiet, in milliseconds. */
const SETTLE_MS = 1500;

/**
 * Opens every page the steps go to once before anything is measured: a dev server compiles a page and pre-bundles
 * what it imports on its first visit, and may reload it meanwhile, which would land on the first state of one arm.
 */
const warmUp = async (request: PagesRequest): Promise<void> => {
  const paths = new Set(
    [...request.states, ...request.acceptance].flatMap((each) =>
      each.steps.flatMap((step) => ("goto" in step ? [step.goto] : []))
    )
  );
  await inFreshPage(request, { viewport: "desktop", scheme: "light" }, async (page) => {
    for (const path of paths) {
      await takeStep(page, { goto: path }, request.origin).catch(() => undefined);
      await page.waitForTimeout(SETTLE_MS);
    }
  });
};

/**
 * Pictures and checks each state, then runs each acceptance check.
 *
 * @param request - the pages and where to write.
 */
export const runPages = async (request: PagesRequest): Promise<PagesResult> => {
  // from the package's real folder: pnpm links it, and its own dependencies sit beside the real one only
  const forgebook = createRequire(
    realpathSync(join(request.folder, "node_modules", "forgebook", "package.json"))
  );
  const axePath = forgebook.resolve("axe-core/axe.min.js");
  await warmUp(request);
  const states: StateMeasure[] = [];
  for (const state of request.states) {
    const picture = `${state.name}.png`;
    try {
      const violations = await inFreshPage(request, state, async (page) => {
        for (const step of state.steps) await takeStep(page, step, request.origin);
        await page.screenshot({
          path: join(request.pictures, picture),
          fullPage: true,
          animations: "disabled"
        });
        await page.addScriptTag({ path: axePath });
        return violationCounts(await page.evaluate("axe.run(document, { resultTypes: ['violations'] })"));
      });
      states.push({ name: state.name, picture: `states/${picture}`, violations });
    } catch (error) {
      states.push({ name: state.name, violations: {}, error: reason(error) });
    }
  }
  const acceptance: PagesResult["acceptance"][number][] = [];
  for (const check of request.acceptance) {
    try {
      await inFreshPage(request, { viewport: "desktop", scheme: "light" }, async (page) => {
        for (const step of check.steps) await takeStep(page, step, request.origin);
      });
      acceptance.push({ name: check.name, isPassed: true });
    } catch (error) {
      acceptance.push({ name: check.name, isPassed: false, error: reason(error) });
    }
  }
  return { states, acceptance };
};
