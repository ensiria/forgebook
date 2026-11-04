/**
 * The logic of `forgebook-shot`: the frame's address of a story with a view, and the run in a browser that opens it,
 * waits for its story and reports.
 *
 * @remarks
 * The frame page is the address the catalogue and the generated tests open: what an agent sees is what a
 * person sees in the stage. `shotAddress` is pure; `takeShot` drives Chromium through Playwright.
 *
 * @module
 */
import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import type { Violation } from "forgebook/a11y";
import { DEFAULT_A11Y_TAGS } from "forgebook/catalogue";
import { codeLiteral } from "forgebook/code-literal";
import { STATUS_ATTRIBUTE } from "forgebook/frame-status";
import { frameAddressOf } from "forgebook/view-state";

import type { ShotStatus, StoryShot } from "./storyShot.types.ts";

/** What a shot is taken of, and how. */
export type ShotRequest = {
  /** The catalogue's address (`http://localhost:5310/`). */
  readonly catalogue: string;
  /** The story's id (`acme-ui:feedback-counter--plain`). */
  readonly story: string;
  /** The view, as the catalogue's address writes it (`theme=dark&lang=it`); empty for the defaults. */
  readonly view: string;
  /** The width the story is drawn at, in CSS px. */
  readonly width: number;
  /** Where the picture goes; none for no picture. */
  readonly out: string | undefined;
  /** Whether to check the story's accessibility. */
  readonly isA11y: boolean;
  /** How long to wait for the story, in ms. */
  readonly timeout: number;
};

/**
 * The frame's address of a story with a view: the catalogue's own `frame.html`, with only what the frame reads.
 *
 * @param catalogue - the catalogue's address.
 * @param story - the story's id.
 * @param view - the view as the catalogue's address writes it.
 */
export const shotAddress = (catalogue: string, story: string, view: string): string =>
  new URL(frameAddressOf("frame.html", story, view), catalogue.endsWith("/") ? catalogue : `${catalogue}/`)
    .href;

/**
 * Opens a story's frame, waits for it, and reports what it shows.
 *
 * @param request - the story, the view and what to do.
 * @returns the report; a frame that never answers is `timeout`, not an exception.
 */
export const takeShot = async (request: ShotRequest): Promise<StoryShot> => {
  const address = shotAddress(request.catalogue, request.story, request.view);
  const browser = await chromium.launch();
  try {
    // a context of its own: axe works only on a page made by one
    const context = await browser.newContext({ viewport: { width: request.width, height: 800 } });
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    await page.goto(address);
    // a text expression: the command runs on Node, where the page's own globals are not typed
    const status = await page
      .waitForFunction(`document.documentElement.getAttribute(${codeLiteral(STATUS_ATTRIBUTE)})`, undefined, {
        timeout: request.timeout
      })
      .then(
        async (handle): Promise<ShotStatus> => ((await handle.jsonValue()) === "ready" ? "ready" : "error")
      )
      .catch((): ShotStatus => "timeout");
    const error =
      status === "error"
        ? ((await page.locator(".forgebook-frame-error__message").first().textContent()) ?? undefined)
        : undefined;
    const box = await page.locator("body").boundingBox();
    const size = { width: Math.ceil(box?.width ?? 0), height: Math.ceil(box?.height ?? 0) };
    if (request.out !== undefined)
      await page.screenshot({ path: request.out, fullPage: true, animations: "disabled" });
    const violations: Violation[] | undefined = request.isA11y
      ? (await new AxeBuilder({ page }).withTags([...DEFAULT_A11Y_TAGS]).analyze()).violations.map(
          (violation) => ({
            id: violation.id,
            help: violation.help,
            impact: violation.impact ?? undefined,
            helpUrl: violation.helpUrl,
            targets: violation.nodes.map((node) => node.target.map(String).join(" "))
          })
        )
      : undefined;
    return {
      story: request.story,
      address,
      status,
      ...(error === undefined ? {} : { error }),
      size,
      ...(request.out === undefined ? {} : { screenshot: request.out }),
      consoleErrors,
      ...(violations === undefined ? {} : { violations })
    };
  } finally {
    await browser.close();
  }
};
