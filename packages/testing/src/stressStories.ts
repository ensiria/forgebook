/**
 * The stress matrix `forgebook check --stress` runs: each story drawn plain, then with worst-case values and views it
 * never declared (long text, a word that cannot break, a huge number, nothing, right to left, 200 % zoom, narrow, dark,
 * more contrast), and only what a case finds that the plain story does not is reported.
 *
 * @remarks
 * Values reach a story the way the props panel gives them: from a parent page on the catalogue's origin, by message. A
 * frame takes values from no address, so a page that frames a story cannot set them; this page is the panel's stand-in,
 * and nothing is written to the project. A problem the plain story already has is the story's, not the case's, so each
 * case is read against it: what remains is what the values or the view broke. Zoom is the story laid out at half the
 * window's width, as a browser at 200 % lays a page out; text sizes a catalogue declares are its own business. Overlays
 * and focus order are left to `check`: a case changes neither.
 *
 * @module
 */
import { AxeBuilder } from "@axe-core/playwright";
import { type Browser, chromium, type Frame, type Page } from "@playwright/test";
import { catalogueSettings } from "forgebook/catalogue";
import { STATUS_ATTRIBUTE } from "forgebook/frame-status";
import { findSpills } from "forgebook/spills";
import type {
  StoryProblem,
  StressCase,
  StressCaseRequest,
  StressReport,
  StressRequest
} from "forgebook/story-check";
import { heldClockAddress } from "forgebook/story-clock";
import { frameAddress, parseView } from "forgebook/view-state";

import { READY_MS } from "./storyPages.ts";

/** The window, as the browser tests' own. */
const WINDOW = { width: 1280, height: 800 };

/** How long a story may take to draw again once given values, in ms. */
const SETTLE_MS = 400;

/** How long a case waits for its animations to end, in ms. */
const ANIMATION_CAP_MS = 2000;

/** The name of the plain case every other is read against. */
const PLAIN = "plain";

/**
 * A problem's key: what makes two the same problem in two cases. An error's numbers are left out, since a message that
 * counts or times something differs between two runs of the same story.
 */
const keyOf = (problem: StoryProblem): string =>
  `${problem.kind}\n${problem.rule ?? ""}\n${problem.element ?? ""}\n${
    problem.kind === "error" || problem.kind === "spill" ? problem.message.replace(/\d+/g, "#") : ""
  }`;

/** How many times each key holds in a list: the same spill twice is two, and one more in a case is new. */
const countsOf = (problems: readonly StoryProblem[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const problem of problems) counts.set(keyOf(problem), (counts.get(keyOf(problem)) ?? 0) + 1);
  return counts;
};

/** The problems a case has beyond the plain story's, each key counted. */
const beyond = (found: readonly StoryProblem[], plain: ReadonlyMap<string, number>): StoryProblem[] => {
  const left = new Map(plain);
  return found.filter((problem) => {
    const key = keyOf(problem);
    const count = left.get(key) ?? 0;
    if (count === 0) return true;
    left.set(key, count - 1);
    return false;
  });
};

/**
 * Hosts a frame in a page on the catalogue's origin, as the shell does, so the frame hears its messages.
 *
 * @param page - a fresh page.
 * @param origin - the catalogue's origin.
 * @param frame - the frame's address.
 * @param width - the frame's width.
 * @returns the frame once it said it is ready, or why it did not.
 */
const hostedFrame = async (
  page: Page,
  origin: string,
  frame: string,
  width: number
): Promise<Frame | string> => {
  await page.setViewportSize(WINDOW);
  // a page of the catalogue's origin with nothing of its own: the frame's parent, and nothing for the checks to find
  await page.goto(`${origin}/__forgebook/api/errors`);
  await page.evaluate(
    ({ src, across }) => {
      document.open();
      document.write(
        `<!doctype html><html lang="en"><head><title>Stress</title><style>body{margin:0}iframe{border:0;display:block;height:100vh}</style></head><body><main></main></body></html>`
      );
      document.close();
      // listened for once the document is written, which drops what listened before: a frame that tells this page
      // nothing would not hear the values either
      const heard: unknown[] = [];
      Object.assign(globalThis, { forgebookHeard: heard });
      addEventListener("message", (event) => heard.push(event.data));
      const element = document.createElement("iframe");
      element.title = "Story";
      element.style.width = `${across}px`;
      element.src = src;
      document.querySelector("main")?.append(element);
    },
    { src: frame, across: width }
  );
  const handle = await page.waitForSelector("iframe");
  const content = await handle.contentFrame();
  if (content === null) return "The frame did not open";
  try {
    await content.waitForFunction(
      (attribute) =>
        ["ready", "error", "pending"].includes(document.documentElement.getAttribute(attribute) ?? ""),
      STATUS_ATTRIBUTE,
      { timeout: READY_MS }
    );
  } catch {
    return `The frame did not say it was ready in ${READY_MS / 1000} s`;
  }
  const status = await content.locator("html").getAttribute(STATUS_ATTRIBUTE);
  if (status !== "ready") return `The story did not draw (${status ?? "no status"})`;
  // the frame talks only to its catalogue's origin: silent here, it talks to another, and values would be lost unseen
  const isHeard = await page
    .waitForFunction(() => (Reflect.get(globalThis, "forgebookHeard") ?? []).length > 0, null, {
      timeout: 5000
    })
    .then(
      () => true,
      () => false
    );
  return isHeard
    ? content
    : "The frame talks to another origin than this catalogue's (frames.origins), so no value could reach it";
};

/** Gives the frame values and a direction, as the panel would, and waits for it to draw again. */
const applied = async (page: Page, content: Frame, request: StressCaseRequest): Promise<void> => {
  if (Object.keys(request.args).length > 0)
    await page.evaluate(
      ({ args, target }) => {
        const element = document.querySelector("iframe");
        element?.contentWindow?.postMessage({ type: "forgebook:args", args }, target);
      },
      { args: request.args, target: new URL(content.url()).origin }
    );
  if (request.isRtl === true)
    await content.evaluate(() => document.documentElement.setAttribute("dir", "rtl"));
  await content.evaluate(
    async ({ wait, cap }) => {
      await new Promise<void>((done) => {
        setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => done())), wait);
      });
      // a component that animates every change of its layout is measured once it has stopped, at most this long after
      const finite = document
        .getAnimations()
        .filter((each) => each.effect?.getTiming().iterations !== Infinity);
      await Promise.race([
        Promise.all(finite.map((each) => each.finished.catch(() => undefined))),
        new Promise((done) => {
          setTimeout(done, cap);
        })
      ]);
    },
    { wait: SETTLE_MS, cap: ANIMATION_CAP_MS }
  );
};

/** What one case finds: axe over the page and its frame, the frame's spills, and the page's errors. */
const caseProblems = async (
  page: Page,
  content: Frame,
  a11y: ReturnType<typeof catalogueSettings>["a11y"],
  errors: readonly string[]
): Promise<StoryProblem[]> => {
  const axe =
    a11y === undefined
      ? []
      : (
          await new AxeBuilder({ page })
            .withTags([...a11y.tags])
            .disableRules([...a11y.disabledRules])
            .analyze()
        ).violations.map(
          (violation): StoryProblem => ({
            kind: "axe",
            rule: violation.id,
            ...(violation.nodes[0] === undefined ? {} : { element: violation.nodes[0].target.join(" ") }),
            message: `${violation.id}: ${violation.help}`
          })
        );
  const spills = (await content.evaluate(findSpills, ".forgebook-frame")).map(
    (spill): StoryProblem => ({
      kind: "spill",
      element: spill.element,
      message: `${spill.element} spills ${spill.by}px out of ${spill.parent}`
    })
  );
  return [...axe, ...spills, ...errors.map((message): StoryProblem => ({ kind: "error", message }))];
};

/** One case of one story, drawn in a context of its own and read against the plain case's problems. */
const ranCase = async (
  browser: Browser,
  request: StressRequest,
  story: StressRequest["stories"][number]["story"],
  each: StressCaseRequest,
  plain: ReadonlyMap<string, number> | undefined
): Promise<{ readonly result: StressCase; readonly found?: readonly StoryProblem[] }> => {
  const catalogue = catalogueSettings("", request.switches, request.lists);
  const view = { ...parseView(each.view, catalogue), backdrop: "plain" as const };
  const frame = heldClockAddress(frameAddress(request.frameUrl, story.id, view, request.switches));
  const base = { name: each.name, storyId: story.id, args: each.args, frame };
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    // thrown errors only: values arrive after the story mounted, so React's warnings about props changing (uncontrolled
    // to controlled) are the run's doing, not the component's; `check` reads the console of the story as written
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const content = await hostedFrame(
      page,
      new URL(request.frameUrl).origin,
      frame,
      each.width ?? WINDOW.width
    );
    if (typeof content === "string") return { result: { ...base, problems: [], notVerified: content } };
    await applied(page, content, each);
    const found = await caseProblems(page, content, catalogue.a11y, errors);
    if (each.name === PLAIN) return { result: { ...base, problems: found }, found };
    if (plain === undefined)
      return { result: { ...base, problems: [], notVerified: "the plain story did not draw" } };
    const expected = new Set(each.expectedRules ?? []);
    // a problem the plain story already has is the story's, and one the case's values cause is the case's
    const own = beyond(found, plain).filter((problem) => !expected.has(problem.rule ?? ""));
    return { result: { ...base, problems: own } };
  } finally {
    await context.close();
  }
};

/**
 * Runs the stress matrix.
 *
 * @param request - the stories with their cases, and the catalogue's settings.
 * @returns one result per story and case, the plain case first and its problems all listed.
 */
export const stressStories = async (request: StressRequest): Promise<StressReport> => {
  const browser = await chromium.launch();
  const cases: StressCase[] = [];
  try {
    for (const { story, cases: asked } of request.stories) {
      const plain = await ranCase(browser, request, story, { name: PLAIN, args: {}, view: "" }, undefined);
      cases.push(plain.result);
      const known = plain.found === undefined ? undefined : countsOf(plain.found);
      for (const each of asked) cases.push((await ranCase(browser, request, story, each, known)).result);
    }
  } finally {
    await browser.close();
  }
  const { a11y } = catalogueSettings("", request.switches, request.lists);
  return { schema: 1, cases, skipped: [], ...(a11y === undefined ? { a11y: "off" as const } : {}) };
};
