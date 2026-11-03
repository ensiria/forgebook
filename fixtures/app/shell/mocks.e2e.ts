/**
 * Mocked APIs on a page of several frames: every frame of a page shares one origin, so one service worker serves them
 * all, and each frame must still be answered by its own story's handlers, or by the network when its story has none.
 *
 * @module
 */

import { expect, type FrameLocator, type Page, test } from "@playwright/test";

/** A service worker's first install, on a cold runner, takes longer than a story's first draw, in milliseconds. */
const WORKER_START = 20_000;

/** The Storybook fixture's stories that fetch, by id, with what each must show. */
const GREETINGS = [
  { id: "sb:fetching-mocked--answered", text: "Hello from a mock" },
  { id: "sb:fetching-mocked--answered-by-name", text: "Named mock" },
  { id: "sb:fetching-mocked--unmocked", text: "No answer" }
] as const;

/** One of those stories. */
type Greeting = (typeof GREETINGS)[number];

/** The frame of a story, among the frames of a page. */
const frameOfStory = (page: Page, id: string): FrameLocator =>
  page.frameLocator(
    `iframe[src*="story=${encodeURIComponent(id)}"]:not([src*="story=${encodeURIComponent(id)}-"])`
  );

/** A page of the catalogue's origin with nothing of its own, to hold frames added in a chosen order. */
const HOST_PAGE = "/forgebook-mocks-host.html";

test("answers each frame of a component page from its own story's handlers, and the others from the network", async ({
  page
}) => {
  await page.goto("/?component=sb:fetching-mocked");
  for (const { id, text } of GREETINGS) {
    await expect(frameOfStory(page, id).getByTestId("greeting")).toHaveText(text, { timeout: WORKER_START });
  }
  // again with the worker already installed, as a person comes back to the page: the mocked frames start at once
  await page.reload();
  for (const { id, text } of GREETINGS) {
    await expect(frameOfStory(page, id).getByTestId("greeting")).toHaveText(text, { timeout: WORKER_START });
  }
});

/** Every order of some stories. */
const ordersOf = (stories: readonly Greeting[]): readonly (readonly Greeting[])[] =>
  stories.length <= 1
    ? [stories]
    : stories.flatMap((first) =>
        ordersOf(stories.filter((each) => each !== first)).map((rest) => [first, ...rest])
      );

/** Every order the frames can load in: a frame with no handlers before, between and after those with some. */
const ORDERS = ordersOf(GREETINGS);

for (const order of ORDERS) {
  test(`answers each frame from its own handlers when they load as ${order.map((each) => each.id.split("--")[1]).join(", ")}`, async ({
    page
  }) => {
    // the host is the context's first page, before any worker serves the origin, so the route answers it
    await page.route(`**${HOST_PAGE}`, (route) =>
      route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Frames</title>" })
    );
    await page.goto(HOST_PAGE);
    for (const { id, text } of order) {
      await page.evaluate((story) => {
        const frame = document.createElement("iframe");
        frame.src = `frame.html?story=${encodeURIComponent(story)}`;
        document.body.append(frame);
      }, id);
      await expect(frameOfStory(page, id).getByTestId("greeting")).toHaveText(text, {
        timeout: WORKER_START
      });
    }
    for (const { id, text } of order) {
      await expect(frameOfStory(page, id).getByTestId("greeting")).toHaveText(text);
    }
  });
}
