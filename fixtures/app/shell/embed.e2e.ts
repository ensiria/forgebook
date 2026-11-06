/**
 * A story alone in another page, and a catalogue with no trace of Forgebook's look: the frame with no chrome, its height
 * as the page around it sees it across origins, the Embed button, and the white-label catalogue
 * (`white-label/forgebook.config.ts`), which sets every role of the theme and turns the branding off.
 *
 * @module
 */
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { test as base, expect, type FrameLocator, type Page } from "@playwright/test";

import { catalogueUrl } from "./ports";

/** The white-label catalogue's address. */
const WHITE_LABEL = catalogueUrl("white-label");

/** A story of the fixture's Select. */
const STORY = "kit:inputs-selection-select--small";

/** A hint long enough to wrap in a narrow page and fit in a wide one. */
const LONG_HINT = "A hint that takes several lines in a narrow page ".repeat(2).trim();

/** Serves a page, on an origin of its own: what a wiki is to the catalogue. */
type ServeHost = (html: string) => Promise<string>;

/** The tests, with a page of another origin to hand: a real server, since a browser refuses a mocked one the catalogue. */
const test = base.extend<{ serveHost: ServeHost }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads a fixture's dependencies from this pattern
  serveHost: async ({}, use) => {
    const server = createServer();
    await use(async (html: string): Promise<string> => {
      server.on("request", (_request, response) => {
        response.setHeader("Content-Type", "text/html");
        response.end(html);
      });
      await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
      const { port } = server.address() as AddressInfo;
      return `http://127.0.0.1:${port}/`;
    });
    server.close();
  }
});

/** The address of a story of the fixture's Select, alone. */
const embed = (query = ""): string => `/?embed&story=${STORY}${query === "" ? "" : `&${query}`}`;

/** The story's frame in an embed opened as the page. */
const storyFrame = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-frame-view");

/** Waits until the frame says its story is drawn. */
const ready = async (frame: FrameLocator): Promise<void> => {
  await expect(frame.locator("html")).toHaveAttribute("data-forgebook-status", "ready");
};

/**
 * Opens a page on another origin holding an iframe of a story, recording every height the embed posts.
 *
 * @param page - the page.
 * @param serveHost - the host's server.
 * @param src - the embed's address.
 * @param attributes - the iframe's attributes.
 */
const openHost = async (
  page: Page,
  serveHost: ServeHost,
  src: string,
  attributes = 'width="600" height="400"'
): Promise<void> => {
  await page.goto(
    await serveHost(`<!doctype html><title>Wiki</title><body style="margin:0">
      <script>
        window.heights = [];
        addEventListener("message", ({ data }) => {
          if (data?.type === "forgebook:embed-size") window.heights.push(data.height);
        });
      </script>
      <iframe id="story" src="${src}" ${attributes} style="border:0"></iframe>`)
  );
};

/** The heights the embed has posted to the host. */
const postedHeights = (page: Page): Promise<number[]> =>
  page.evaluate(() => (window as unknown as { heights: number[] }).heights);

/** The story's frame inside the host's iframe. */
const hostedStory = (page: Page): FrameLocator =>
  page.frameLocator("#story").frameLocator("iframe.forgebook-frame-view");

test.describe("a story alone", () => {
  test("shows the story and none of the shell", async ({ page }) => {
    await page.goto(embed());
    await ready(storyFrame(page));
    await expect(storyFrame(page).locator("[role=combobox], select, button").first()).toBeVisible();
    for (const chrome of [
      ".forgebook-sidebar",
      ".forgebook-toolbar",
      ".forgebook-header",
      ".forgebook-dock",
      ".forgebook-stage-tools",
      ".forgebook-viewport"
    ]) {
      await expect(page.locator(chrome)).toHaveCount(0);
    }
    await expect(page).toHaveTitle("Select · Fixture catalogue");
    // the story touches the page's edges: no margin of the shell's around it
    const box = await page.locator("iframe.forgebook-frame-view").boundingBox();
    expect(box).toMatchObject({ x: 0, y: 0, width: 1280 });
  });

  test("draws the view and the args the address names, and takes the page's look from the story", async ({
    page
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(embed(`theme=dark&args=${encodeURIComponent('{"hint":"From the address"}')}`));
    await ready(storyFrame(page));
    await expect(storyFrame(page).locator("small")).toHaveText("From the address");
    await expect(storyFrame(page).locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveAttribute("data-forgebook-appearance", "dark");
    await expect(page).toHaveURL(/embed/);
  });

  test("reads a Storybook link's args, and says which it could not read", async ({ page }) => {
    await page.goto(embed("args=hint:From+a+link;style.color:red"));
    await ready(storyFrame(page));
    await expect(storyFrame(page).locator("small")).toHaveText("From a link");
    await expect(page.getByRole("alert")).toContainText("style");
  });

  test("says so when the address names no story, or one that is not there", async ({ page }) => {
    await page.goto("/?embed");
    await expect(page.getByRole("alert")).toHaveText("This address names no story.");
    await page.goto("/?embed&story=nowhere");
    await expect(page.getByRole("alert")).toHaveText('No story "nowhere": it may have been renamed.');
    await expect(page.locator(".forgebook-sidebar")).toHaveCount(0);
  });

  test("a story that throws is told in the catalogue's look, not the frame's", async ({ page }) => {
    // on the second catalogue: the fixture app's errors are counted by the `forgebook errors` tests
    await page.goto(`${WHITE_LABEL}?embed&story=kit:inputs-selection-select--throws`);
    await expect(page.getByRole("alert")).toContainText("This story could not be shown.");
    await expect(page.locator(".forgebook-frame-view")).toBeHidden();
  });

  test("works where the browser denies a third-party frame its storage", async ({ page }) => {
    await page.addInitScript(() => {
      for (const name of ["localStorage", "sessionStorage"]) {
        Object.defineProperty(window, name, {
          get: () => {
            throw new DOMException("denied", "SecurityError");
          }
        });
      }
    });
    await page.goto(embed());
    await ready(storyFrame(page));
  });
});

test.describe("in a page of another origin", () => {
  test("tells the page the story's height, and the page learns nothing else", async ({
    page,
    baseURL,
    serveHost
  }) => {
    const messages: unknown[] = [];
    await page.exposeFunction("recordMessage", (message: unknown) => messages.push(message));
    await page.addInitScript(() => {
      addEventListener("message", ({ data }) => {
        (window as unknown as { recordMessage?: (message: unknown) => void }).recordMessage?.(data);
      });
    });
    await openHost(page, serveHost, `${baseURL}${embed().slice(1)}`);
    await ready(hostedStory(page));
    await expect.poll(() => postedHeights(page)).not.toEqual([]);
    const [first] = await postedHeights(page);
    expect(first).toBeGreaterThan(0);
    const fromEmbed = messages.filter(
      (message) => (message as { type?: string }).type?.startsWith("forgebook:embed") === true
    );
    expect(Object.keys(fromEmbed[0] as object).sort()).toEqual(["height", "type"]);
  });

  test("follows the width it is given: a narrower page, a taller story", async ({
    page,
    baseURL,
    serveHost
  }) => {
    await openHost(
      page,
      serveHost,
      `${baseURL}${embed(`args=${encodeURIComponent(JSON.stringify({ hint: LONG_HINT }))}`).slice(1)}`,
      'width="900" height="400"'
    );
    await ready(hostedStory(page));
    await expect(hostedStory(page).locator("small")).toHaveText(LONG_HINT);
    await expect.poll(async () => (await postedHeights(page)).length).toBeGreaterThan(0);
    const wide = (await postedHeights(page)).at(-1) ?? 0;
    await page.locator("#story").evaluate((frame) => frame.setAttribute("width", "300"));
    await expect.poll(async () => (await postedHeights(page)).at(-1) ?? 0).toBeGreaterThan(wide);
    await expect(hostedStory(page).locator("html")).toHaveAttribute("data-forgebook-status", "ready");
    const width = await hostedStory(page)
      .locator("body")
      .evaluate((body) => body.getBoundingClientRect().width);
    expect(width).toBe(300);
  });

  test("a box shorter than the story scrolls inside; a taller one is filled, and neither grows the story", async ({
    page,
    baseURL,
    serveHost
  }) => {
    await openHost(
      page,
      serveHost,
      `${baseURL}?embed&story=kit:inputs-selection-select--overview`,
      'width="600" height="40"'
    );
    await ready(hostedStory(page));
    const embedded = page.frames().find((frame) => frame.url().includes("embed"));
    await expect
      .poll(() =>
        embedded?.evaluate(
          () => document.documentElement.scrollHeight > document.documentElement.clientHeight
        )
      )
      .toBe(true);
    await page.locator("#story").evaluate((frame) => frame.setAttribute("height", "2000"));
    const frameBox = hostedStoryHeight(page);
    await expect.poll(frameBox).toBe(2000);
    const posted = await postedHeights(page);
    expect(Math.max(...posted)).toBeLessThan(2000);
  });

  test("the code the panel copies works, script and all, and follows the story", async ({
    page,
    baseURL,
    context,
    serveHost
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL ?? "" });
    await page.goto(`/?story=${STORY}`);
    await page.getByRole("button", { name: "Embed this story" }).click();
    await page.getByRole("switch", { name: "Follow the story's height" }).check();
    await page.getByRole("button", { name: "Copy: HTML" }).click();
    const code = await page.evaluate(() => navigator.clipboard.readText());
    expect(code).toContain("<iframe");
    await page.goto(await serveHost(`<!doctype html><title>Wiki</title>${code}`));
    await ready(page.frameLocator("iframe").frameLocator("iframe.forgebook-frame-view"));
    const reported = await page
      .frameLocator("iframe")
      .frameLocator("iframe.forgebook-frame-view")
      .locator("body")
      .evaluate((body) => Math.ceil(body.getBoundingClientRect().height));
    await expect.poll(() => page.locator("iframe").first().getAttribute("height")).toBe(String(reported));
  });
});

/** The height of the story's frame in the host's iframe. */
const hostedStoryHeight =
  (page: Page): (() => Promise<number | undefined>) =>
  () =>
    page
      .frameLocator("#story")
      .locator("iframe.forgebook-frame-view")
      .evaluate((frame) => frame.getBoundingClientRect().height);

test.describe("the Embed button", () => {
  test("gives the link and the code of what is on screen, loaded only when opened", async ({ page }) => {
    const panelRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("EmbedPanel")) panelRequests.push(request.url());
    });
    await page.goto(`/?story=${STORY}&theme=dark&zoom=150`);
    await ready(storyFrame(page));
    expect(panelRequests).toEqual([]);
    const button = page.getByRole("button", { name: "Embed this story" });
    await button.click();
    const panel = page.getByRole("dialog", { name: "Embed this story" });
    const link = panel.getByRole("textbox", { name: "Link" });
    await expect(link).toBeFocused();
    expect(panelRequests).not.toEqual([]);
    const address = new URL(await link.inputValue());
    expect(address.searchParams.has("embed")).toBe(true);
    expect(address.searchParams.get("story")).toBe(STORY);
    expect(address.searchParams.get("theme")).toBe("dark");
    expect(address.searchParams.has("zoom")).toBe(false);
    await expect(panel.getByRole("textbox", { name: "HTML" })).toHaveValue(/^<iframe src="/);
    // a dev server's address reaches nobody else, and the panel says so
    await expect(panel).toContainText("opens only on this computer");
    expect(await panel.getByRole("textbox", { name: "HTML" }).inputValue()).not.toContain("<script>");
    await panel.getByRole("switch", { name: "Follow the story's height" }).check();
    await expect.poll(() => panel.getByRole("textbox", { name: "HTML" }).inputValue()).toContain("<script>");
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(button).toBeFocused();
  });

  test("keeps its panel inside a phone's window", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 700 });
    await page.goto(`/?story=${STORY}`);
    await ready(storyFrame(page));
    await page.getByRole("button", { name: "Embed this story" }).click();
    const panel = page.getByRole("dialog", { name: "Embed this story" });
    await expect(panel).toBeInViewport({ ratio: 1 });
    // pressed for real: a panel clipped by the pane around it would not take the press
    await panel.getByRole("switch", { name: "Follow the story's height" }).check();
    await expect.poll(() => panel.getByRole("textbox", { name: "HTML" }).inputValue()).toContain("<script>");
  });

  for (const [width, height] of [
    [1000, 700],
    [1280, 460],
    [680, 700],
    [360, 700]
  ] as const) {
    test(`stays whole in a ${width} × ${height} window, whatever the pane under it`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto(`/?story=${STORY}`);
      await ready(storyFrame(page));
      await page.getByRole("button", { name: "Embed this story" }).click();
      const panel = page.getByRole("dialog", { name: "Embed this story" });
      await expect(panel.getByRole("textbox", { name: "Link" })).toBeFocused();
      await expect(panel).toBeInViewport({ ratio: 1 });
      await panel.getByRole("switch", { name: "Follow the story's height" }).check();
      await expect(panel).toBeInViewport({ ratio: 1 });
    });
  }

  test("writes the height the frame has on the stage, not the story's content", async ({ page }) => {
    await page.goto(`/?story=${STORY}&height=500`);
    await ready(storyFrame(page));
    await page.getByRole("button", { name: "Embed this story" }).click();
    await expect(page.getByRole("textbox", { name: "HTML" })).toHaveValue(/height="500"/);
    await expect(page.getByRole("textbox", { name: "Link" })).toHaveValue(/height=500/);
  });

  test("a panel that cannot load says so, and the catalogue stays", async ({ page }) => {
    await page.route(/EmbedPanel/, (route) => route.abort());
    await page.goto(`/?story=${STORY}`);
    await ready(storyFrame(page));
    await page.getByRole("button", { name: "Embed this story" }).click();
    await expect(page.getByRole("dialog", { name: "Embed this story" }).getByRole("alert")).toBeVisible();
    await expect(page.locator(".forgebook-sidebar")).toBeVisible();
  });

  test("where the browser gives no clipboard, the text is selected for the keys", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { value: undefined }));
    await page.goto(`/?story=${STORY}`);
    await ready(storyFrame(page));
    await page.getByRole("button", { name: "Embed this story" }).click();
    const panel = page.getByRole("dialog", { name: "Embed this story" });
    await panel.getByRole("button", { name: "Copy: Link" }).click();
    await expect(panel.getByRole("button", { name: "Copy: Link" })).toContainText("Selected");
    const selected = await panel
      .getByRole("textbox", { name: "Link" })
      .evaluate((field: HTMLInputElement) => field.selectionEnd === field.value.length);
    expect(selected).toBe(true);
  });

  test("the whole catalogue never loads what an embed uses", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto(`/?story=${STORY}`);
    await ready(storyFrame(page));
    expect(requests.filter((url) => /EmbedPage|embed\.scss/.test(url))).toEqual([]);
  });
});

test.describe("a catalogue with its own look throughout", () => {
  /** A custom property on the page's root. */
  const custom = (page: Page, name: string): Promise<string> =>
    page.evaluate(
      (property) => getComputedStyle(document.documentElement).getPropertyValue(property).trim(),
      name
    );

  test("shows its name alone, with neither Forgebook's mark nor its icon", async ({ page }) => {
    await page.goto(WHITE_LABEL);
    await expect(page.getByRole("link", { name: "Ember UI", exact: true })).toBeVisible();
    await expect(page.locator(".forgebook-brand__logo")).toHaveCount(0);
    await expect(page.locator('link[rel~="icon"]')).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Forgebook");
  });

  test("slides its sidebar over the page on a phone's width, in its own colours", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 700 });
    await page.goto(WHITE_LABEL);
    const sidebar = page.locator(".forgebook-sidebar");
    await expect(sidebar).not.toBeInViewport();
    await page.getByRole("button", { name: "Show the sidebar" }).click();
    await expect(sidebar).toBeInViewport({ ratio: 1 });
    await expect(page.locator(".forgebook-main")).toHaveAttribute("inert");
    await page.keyboard.press("Escape");
    await expect(sidebar).not.toBeInViewport();
    await expect(page.getByRole("button", { name: "Show the sidebar" })).toBeFocused();
  });

  test("an embed wears the theme in both appearances: colours, fonts and corners", async ({ page }) => {
    await page.goto(`${WHITE_LABEL}?embed&story=${STORY}`);
    await ready(storyFrame(page));
    await expect(page.locator("html")).toHaveAttribute("data-forgebook-appearance", /light|dark/);
    await page.goto(`${WHITE_LABEL}?embed&story=${STORY}&theme=dark`);
    await ready(storyFrame(page));
    await expect.poll(() => custom(page, "--forgebook-surface")).toBe("#2c1f15");
    await expect(page.locator("body")).toHaveCSS("font-family", /Georgia/);
    await page.goto(`${WHITE_LABEL}?embed&story=nowhere`);
    await expect(page.getByRole("alert")).toHaveCSS("font-family", /Georgia/);
  });

  test("the box a frame draws for a failed story wears the theme too", async ({ page }) => {
    await page.goto(`${WHITE_LABEL}frame.html?story=kit:inputs-selection-select--throws`);
    const box = page.locator(".forgebook-frame-error");
    await expect(box).toHaveCSS("font-family", /Georgia/);
    await expect(box).toHaveCSS("color", "rgb(161, 18, 46)");
  });

  test("nothing it draws keeps a colour of Forgebook's default palette", async ({ page }) => {
    await page.goto(`${WHITE_LABEL}?story=${STORY}`);
    await ready(storyFrame(page));
    for (const appearance of ["light", "dark"]) {
      await page.evaluate(
        (value) => document.documentElement.setAttribute("data-forgebook-appearance", value),
        appearance
      );
      const leftovers = await page.evaluate(() => {
        const palette = new Set([
          "rgb(246, 246, 248)",
          "rgb(235, 235, 239)",
          "rgb(29, 29, 31)",
          "rgb(10, 108, 240)",
          "rgb(0, 89, 210)",
          "rgb(22, 22, 24)",
          "rgb(30, 30, 33)",
          "rgb(37, 37, 41)",
          "rgb(242, 242, 244)",
          "rgb(31, 111, 229)",
          "rgb(122, 179, 255)"
        ]);
        return [...document.querySelectorAll("body, body *")].flatMap((element) => {
          const style = getComputedStyle(element);
          const found = [style.color, style.backgroundColor, style.borderTopColor, style.outlineColor].filter(
            (color) => palette.has(color)
          );
          return found.length === 0 ? [] : [`${element.className}: ${found.join(", ")}`];
        });
      });
      expect(leftovers).toEqual([]);
    }
  });
});
