/**
 * A catalogue that checks no accessibility and reads no component docs (`parity/forgebook.config.ts`): no Accessibility
 * tab or column and nothing of axe fetched, the Props tab's controls made from the story's args, no API reference and
 * no "Used in", and no docs asked of the server.
 *
 * @module
 */
import { expect, type Page, test } from "@playwright/test";

import { catalogueUrl } from "./ports";

/** The catalogue's address. */
const PARITY = catalogueUrl("parity");

/** The fixture's Select, drawn from its args. */
const SMALL = `${PARITY}?story=kit:inputs-selection-select--small`;

/** The Select's page. */
const SELECT = `${PARITY}?component=kit:inputs-selection-select`;

/**
 * The addresses the page fetches from now on that read docs or axe.
 *
 * @param page - the page.
 */
const docsAndAxeRequests = (page: Page): string[] => {
  const asked: string[] = [];
  page.on("request", (request) => {
    // a component's docs (`?forgebook-docs`), never its docs pages (`forgebook-docs-pages`), and axe's script
    if (/[?&]forgebook-docs(?:$|&)|\baxe\b/.test(request.url())) asked.push(request.url());
  });
  return asked;
};

test.describe("a catalogue without accessibility checks or component docs", () => {
  test("offers the story's args as its props, which set the story, and no Accessibility tab", async ({
    page
  }) => {
    const asked = docsAndAxeRequests(page);
    await page.goto(SMALL);
    const frame = page.frameLocator("iframe.forgebook-frame-view");
    await expect(frame.locator("select")).toHaveAttribute("data-size", "sm");
    await expect(page.getByRole("tab", { name: "Props" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Accessibility/ })).toHaveCount(0);
    const size = page.getByRole("textbox", { name: "size" });
    await expect(size).toHaveValue("sm");
    await size.fill("lg");
    await expect(frame.locator("select")).toHaveAttribute("data-size", "lg");
    await expect(page).toHaveURL(/args=/);
    // the meta's list of options, which no control sets, is listed for reading
    await expect(page.getByText("options", { exact: true })).toBeVisible();
    expect(asked).toEqual([]);
  });

  test("draws a component's page without an API reference or Used in", async ({ page }) => {
    const asked = docsAndAxeRequests(page);
    await page.goto(SELECT);
    await expect(page.locator(".forgebook-doc h2")).toHaveText(["Accessibility", "Examples"]);
    await expect(page.locator(".forgebook-api__table")).toHaveCount(0);
    expect(asked).toEqual([]);
  });

  test("leaves the accessibility column and its check out of a tester's page", async ({ page }) => {
    await page.goto(`${SELECT}&audience=tester`);
    const coverage = page.getByRole("region", { name: "What the stories cover" });
    await expect(coverage.getByRole("columnheader")).toHaveText([
      "Story",
      "Group",
      "Play",
      "Generated tests"
    ]);
    await expect(coverage.getByRole("button", { name: /Check/ })).toHaveCount(0);
  });
});
