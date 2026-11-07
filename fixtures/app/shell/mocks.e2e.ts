/**
 * Mocked APIs on a page of several frames: every frame of a page shares one origin, so one service worker serves them
 * all, and each frame must still be answered by its own story's handlers, or by the network when its story has none.
 *
 * @module
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, type FrameLocator, type Page, test } from "@playwright/test";

import { framesPortOf } from "./ports";

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

/**
 * A page of the catalogue's origin with nothing of its own, to hold frames added in a chosen order: a file of the public
 * folder, since a page a test's route makes up has no address on this machine, and the browser then keeps it from the
 * frames' origin, a local one.
 */
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

/** How long a frame's own reload is held, in milliseconds: past the moment every frame decides whether to reload. */
const RELOAD_HELD = 1500;

test("answers every frame from its own handlers when the worker's registration takes none of them over", async ({
  page
}) => {
  const answered = GREETINGS[0];
  const byName = GREETINGS[1];
  // the host on the frames' origin, beside them: it reaches their worker's registration, and they reach it
  await page.goto(`http://127.0.0.1:${framesPortOf("app")}${HOST_PAGE}`);
  const addFrames = (stories: readonly Greeting[]): Promise<void> =>
    page.evaluate(
      (ids) => {
        for (const id of ids) {
          const frame = document.createElement("iframe");
          frame.src = `frame.html?story=${encodeURIComponent(id)}`;
          document.body.append(frame);
        }
      },
      stories.map(({ id }) => id)
    );
  // a first frame installs the worker; once it is unregistered, as MSW's script does when it sees no page left, the
  // registration stays active for the pages it serves but takes no new page over
  await addFrames([answered]);
  await expect(frameOfStory(page, answered.id).getByTestId("greeting")).toHaveText(answered.text, {
    timeout: WORKER_START
  });
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())?.unregister();
    document.querySelector("iframe")?.remove();
  });
  // the order a busy machine gives: both new frames look for a registration before either registers again, so MSW's
  // script finds none and reloads neither; each must then reload itself
  await page.context().addInitScript(() => {
    const host = window.top;
    if (host === null || host === window) return;
    const getRegistrations = ServiceWorkerContainer.prototype.getRegistrations;
    ServiceWorkerContainer.prototype.getRegistrations = async function (this: ServiceWorkerContainer) {
      const registrations = await getRegistrations.call(this);
      Reflect.set(host, "framesAsking", Number(Reflect.get(host, "framesAsking") ?? 0) + 1);
      await new Promise<void>((resolve) => {
        const resolveOnceBothAsked = (): void => {
          if (Number(Reflect.get(host, "framesAsking")) >= 2) resolve();
          else setTimeout(resolveOnceBothAsked, 10);
        };
        resolveOnceBothAsked();
      });
      return registrations;
    };
  });
  // a frame's reload is held, so the first to reload cannot be served again before the other decides
  const loads = new Map<string, number>();
  await page.context().route(/\/frame\.html\?/, async (route) => {
    const address = route.request().url();
    const count = (loads.get(address) ?? 0) + 1;
    loads.set(address, count);
    if (count > 1) await new Promise((resolve) => setTimeout(resolve, RELOAD_HELD));
    await route.continue();
  });
  await addFrames([answered, byName]);
  for (const { id, text } of [answered, byName]) {
    await expect(frameOfStory(page, id).getByTestId("greeting")).toHaveText(text, { timeout: WORKER_START });
  }
});

/** How long the worker below holds a page's closing for the same page's next start, at most, in milliseconds. */
const CLOSE_HELD = 1000;

/**
 * MSW's worker as a busy machine runs it: a page's closing, which looks at the open pages before it forgets the page,
 * ends only after the same page starts again, if it does within a moment.
 */
const SLOW_CLOSING_WORKER = readFileSync(
  join(import.meta.dirname, "..", "public", "mockServiceWorker.js"),
  "utf8"
)
  .replace(
    "activeClientIds.delete(clientId);",
    `await new Promise((resolve) => {
          startedAgain.set(clientId, resolve);
          setTimeout(resolve, ${CLOSE_HELD});
        });
        activeClientIds.delete(clientId);`
  )
  .replace(
    "activeClientIds.add(clientId);",
    `activeClientIds.add(clientId);
          startedAgain.get(clientId)?.();`
  )
  .replace(
    "const activeClientIds = new Set();",
    "const activeClientIds = new Set();\nconst startedAgain = new Map();"
  );

test("keeps a story's mocks when it is played again", async ({ page }) => {
  const [answered] = GREETINGS;
  await page
    .context()
    .route("**/mockServiceWorker.js", (route) =>
      route.fulfill({ contentType: "text/javascript", body: SLOW_CLOSING_WORKER })
    );
  await page.goto(`/?story=${answered.id}`);
  const frame = frameOfStory(page, answered.id);
  const firstDrawn = frame.getByTestId("greeting");
  await expect(firstDrawn).toHaveText(answered.text, { timeout: WORKER_START });
  // marked, so the story drawn again is told from the first one
  await firstDrawn.evaluate((element) => element.setAttribute("data-first", ""));
  await page.evaluate(() =>
    document
      .querySelector("iframe")
      ?.contentWindow?.postMessage({ type: "forgebook:play-step", command: "again" }, "*")
  );
  await expect(frame.locator('[data-testid="greeting"]:not([data-first])')).toHaveText(answered.text);
});
