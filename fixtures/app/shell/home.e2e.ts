/**
 * The home in the browser: the fixture's written home (`forgebook.home.md`), its values and its pieces of the generated
 * home among its own text, and the generated home the same catalogue keeps without it (`forgebook.generated.config.ts`).
 *
 * @module
 */
import { expect, test } from "@playwright/test";

import { catalogueUrl } from "./ports";

test.describe("the written home", () => {
  test("shows the authors' text, the catalogue's title, and the values filled in", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Fixture catalogue");
    await expect(page.locator(".forgebook-home__head .forgebook-doc__lead")).toHaveText(
      /^\d+ components and \d+ stories in 2 libraries, version 0\.0\.0\.$/
    );
    await expect(page.locator(".forgebook-home--written .forgebook-prose").first()).toContainText(
      "written by its authors"
    );
    await expect(page.getByRole("note", { name: "Start here" })).toContainText("New to the kit?");
    // a file with no problem lists none
    await expect(page.getByText("The home's file has problems")).toHaveCount(0);
  });

  test("its link cards and its pieces open what they name, in place", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => Reflect.set(window, "forgebookKept", true));
    await page.getByRole("link", { name: /Every block/ }).click();
    await expect(page).toHaveURL(/page=kit%3Ablocks/);
    await expect(page.locator("h1")).toHaveText("Blocks");
    await page.goBack();
    const families = page.locator("section", {
      has: page.getByRole("heading", { name: "Components", exact: true })
    });
    await families.getByRole("article", { name: "Inputs" }).getByRole("link", { name: "Select" }).click();
    await expect(page).toHaveURL(/component=kit%3Ainputs-selection-select/);
    expect(await page.evaluate(() => Reflect.get(window, "forgebookKept"))).toBe(true);
  });

  test("lists the docs pages under the authors' heading, and draws a live story", async ({ page }) => {
    await page.goto("/");
    const guides = page.locator("section", {
      has: page.getByRole("heading", { name: "Guides", exact: true })
    });
    await expect(guides.getByRole("link", { name: "Blocks" })).toBeVisible();
    const frame = page.frameLocator("iframe.forgebook-frame-view").first();
    await expect(frame.locator("html")).toHaveAttribute("data-forgebook-status", "ready");
  });
});

test.describe("the generated home", () => {
  test("stays as it was for a catalogue without a written home", async ({ page }) => {
    await page.goto(catalogueUrl("generated-home"));
    await expect(page.locator("h1")).toHaveText("Fixture catalogue");
    await expect(page.locator(".forgebook-home__head .forgebook-doc__lead")).toHaveText(
      /^\d+ components in 2 libraries\.$/
    );
    await expect(page.locator(".forgebook-home--written")).toHaveCount(0);
    const library = page.getByRole("region", { name: "Fixture kit" });
    await expect(library.getByRole("article", { name: "Inputs" })).toContainText("Select");
    await expect(
      library.getByRole("article", { name: "Docs" }).getByRole("link", { name: "Blocks" })
    ).toBeVisible();
  });
});
