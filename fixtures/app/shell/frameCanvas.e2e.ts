/**
 * What shows behind a story: its frame stays transparent over the page colour the shell draws, in every combination of
 * the shell's appearance, the story's theme and a document that declares its colour scheme or does not.
 *
 * @remarks
 * A browser paints an opaque canvas behind a document whose colour scheme differs from its frame element's. Nothing in
 * either document's styles says so: only the pixels on the screen do, so these tests read a screenshot.
 *
 * @module
 */
import { expect, type Locator, type Page, test } from "@playwright/test";

/** A story of the fixture's Select: its document paints no background of its own. */
const STORY = "kit:inputs-selection-select--small";

/** A theme's rule, as a library writes it, that makes the document declare the scheme it draws in. */
const DECLARED_SCHEME =
  '[data-theme="dark"] { color-scheme: dark; } [data-theme="light"] { color-scheme: light; }';

/** Makes every frame's page carry a rule in its `head`, as a theme's style sheet would. */
const serveFramesWith = async (page: Page, rule: string): Promise<void> => {
  await page.route(/[?&]story=/, async (route) => {
    const request = route.request();
    if (request.resourceType() !== "document" || request.frame().parentFrame() === null) {
      await route.fallback();
      return;
    }
    const response = await route.fetch();
    const body = (await response.text()).replace("<head>", `<head><style>${rule}</style>`);
    await route.fulfill({ response, body });
  });
};

/** The colour of a pixel of a screenshot, as `rgb(1, 2, 3)`, decoded by a page that shows nothing else. */
const pixelOf = async (page: Page, picture: Buffer, x: number, y: number): Promise<string> => {
  const decoder = await page.context().newPage();
  const colour = await decoder.evaluate(
    async ({ encoded, left, top }) => {
      const response = await fetch(`data:image/png;base64,${encoded}`);
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d");
      context?.drawImage(bitmap, 0, 0);
      const [red, green, blue] = context?.getImageData(left, top, 1, 1).data ?? [];
      return `rgb(${red}, ${green}, ${blue})`;
    },
    { encoded: picture.toString("base64"), left: x, top: y }
  );
  await decoder.close();
  return colour;
};

/** The colour a frame shows near its bottom right corner, past the rounded edge of a cell, where a short story draws nothing. */
const cornerOf = async (page: Page, frame: Locator): Promise<string> => {
  const box = await frame.boundingBox();
  if (box === null) throw new Error("The frame has no box");
  const picture = await page.screenshot({ clip: box });
  return pixelOf(page, picture, Math.floor(box.width) - 12, Math.floor(box.height) - 12);
};

/** The nearest colour painted behind an element, in the shell's document. */
const colourBehind = (frame: Locator): Promise<string> =>
  frame.evaluate((element) => {
    for (let at = element.parentElement; at !== null; at = at.parentElement) {
      const colour = getComputedStyle(at).backgroundColor;
      if (colour !== "rgba(0, 0, 0, 0)") return colour;
    }
    return "none";
  });

/** Waits until the shell has heard that every frame of the page is drawn. */
const settled = async (page: Page): Promise<void> => {
  await expect(page.locator("iframe.forgebook-frame-view").first()).toBeVisible();
  await expect(page.locator("[data-loading]")).toHaveCount(0);
};

test.describe("what shows behind a story", () => {
  for (const shell of ["light", "dark"] as const) {
    for (const theme of ["light", "dark"] as const) {
      for (const isDeclared of [false, true]) {
        const declared = isDeclared ? "declares its scheme" : "declares none";
        test(`a ${theme} story in a ${shell} shell, whose document ${declared}`, async ({ page }) => {
          await page.emulateMedia({ colorScheme: shell });
          if (isDeclared) await serveFramesWith(page, DECLARED_SCHEME);
          await page.goto(`/?story=${STORY}&theme=${theme}`);
          await settled(page);
          const frame = page.locator("iframe.forgebook-frame-view");
          await expect.poll(() => frame.evaluate((each) => each.style.colorScheme)).not.toBe("");
          expect(await cornerOf(page, frame)).toBe(await colourBehind(frame));
        });
      }
    }
  }

  for (const shell of ["light", "dark"] as const) {
    test(`every cell of a comparison of themes in a ${shell} shell`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: shell });
      await page.goto(`/?story=${STORY}&compare=theme`);
      await settled(page);
      await expect(page.getByRole("figure", { name: "Dark", exact: true })).toBeVisible();
      for (const frame of await page.locator("iframe.forgebook-frame-view").all())
        expect(await cornerOf(page, frame)).toBe(await colourBehind(frame));
    });
  }

  test("follows a scheme the document takes later, and leaves the story's system preference alone", async ({
    page
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(`/?story=${STORY}`);
    await settled(page);
    const frame = page.locator("iframe.forgebook-frame-view");
    await expect.poll(() => frame.evaluate((each) => each.style.colorScheme)).toBe("light");
    const content = page.frameLocator("iframe.forgebook-frame-view").locator("html");
    expect(await content.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches)).toBe(true);
    await content.evaluate((root) => root.style.setProperty("color-scheme", "dark"));
    await expect.poll(() => frame.evaluate((each) => each.style.colorScheme)).toBe("dark");
  });
});
