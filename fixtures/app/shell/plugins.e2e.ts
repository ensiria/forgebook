/**
 * The plugin API in the browser: the fixture's probe touches every place the contract offers, and the MSW plugin is the
 * real thing. What a plugin adds shows only where it is asked for, a tab loads when it opens, and a broken one stays in
 * its tab.
 *
 * @module
 */
import { expect, type FrameLocator, type Page, test } from "@playwright/test";

/** The address of a story. */
const story = (id: string): string => `/?story=${id}`;

/** The story that asks for the probe. */
const PROBE = story("sb:testing-plugin-probe--probe");

/** A story that asks for nothing. */
const PLAIN = story("kit:inputs-selection-select--small");

/** A story whose API is mocked. */
const MOCKED = story("sb:fetching-mocked--answered");

/** A service worker's first install, on a cold runner, takes longer than a story's first draw, in milliseconds. */
const WORKER_START = 20_000;

/** The story's frame. */
const frameOf = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-frame-view");

test.describe("a plugin's tab", () => {
  test("shows only for a story with its parameter", async ({ page }) => {
    await page.goto(PLAIN);
    await expect(page.getByRole("tab", { name: "Accessibility" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Probe", exact: true })).toHaveCount(0);
    await page.goto(PROBE);
    await expect(page.getByRole("tab", { name: "Probe" }).first()).toBeVisible();
  });

  test("loads its code when it opens, and reads the story and what its frame reported", async ({ page }) => {
    const modules: string[] = [];
    page.on("request", (request) => modules.push(request.url()));
    await page.goto(PROBE);
    const tab = page.getByRole("tab", { name: /^Probe/ });
    await expect(tab).toBeVisible();
    expect(modules.filter((url) => url.includes("ProbeTab"))).toEqual([]);
    await tab.click();
    const shown = page.getByTestId("probe-tab");
    await expect(shown).toContainText("Probe sb:testing-plugin-probe--probe v1 light");
    await expect(shown).toContainText('{"reports":1}');
    expect(modules.some((url) => url.includes("ProbeTab"))).toBe(true);
  });

  test("notes what its frame reported beside its name, and hears the next report", async ({ page }) => {
    await page.goto(`${PROBE}&tab=probe`);
    const tab = page.getByRole("tab", { name: /^Probe/ });
    await expect(tab).toContainText("1");
    await expect(page.getByTestId("probe-tab")).toContainText('{"reports":1}');
    await frameOf(page)
      .locator("html")
      .evaluate((root) => root.ownerDocument.defaultView?.dispatchEvent(new Event("probe:report")));
    await expect(page.getByTestId("probe-tab")).toContainText('{"reports":2}');
    await expect(tab).toContainText("2");
  });

  test("follows the shell's appearance", async ({ page }) => {
    await page.goto(`${PROBE}&tab=probe`);
    await expect(page.getByTestId("probe-tab")).toContainText("light");
    await page.evaluate(() => document.documentElement.setAttribute("data-forgebook-appearance", "dark"));
    await expect(page.getByTestId("probe-tab")).toContainText("dark");
  });

  test("says in its place that it failed, and leaves the page standing", async ({ page }) => {
    await page.goto(`${PROBE}&tab=probe-broken`);
    await expect(page.getByRole("alert")).toContainText("The probe breaks on purpose");
    await page.getByRole("tab", { name: "Accessibility" }).click();
    await expect(page.getByRole("button", { name: /Run|Check/ }).first()).toBeVisible();
    await expect(frameOf(page).getByTestId("probed")).toBeVisible();
  });

  test("keeps the keyboard's way through the tabs", async ({ page }) => {
    await page.goto(`${PROBE}&tab=probe`);
    const tab = page.getByRole("tab", { name: /^Probe/ });
    await tab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Broken probe" })).toBeFocused();
  });
});

test.describe("a plugin's switch and decorator", () => {
  test("the switch joins the View menu, and its value reaches the decorator live", async ({ page }) => {
    await page.goto(PROBE);
    const decorator = frameOf(page).getByTestId("probe-decorator");
    await expect(decorator).toHaveAttribute("data-probe", "calm");
    await page.getByRole("button", { name: "View", exact: true }).click();
    await page.locator('[data-control="probe"]').getByText("Loud").click();
    await expect(page).toHaveURL(/probe=loud/);
    await expect(decorator).toHaveAttribute("data-probe", "loud");
  });

  test("the decorator wraps the story, and leaves others alone", async ({ page }) => {
    await page.goto(PROBE);
    await expect(frameOf(page).getByTestId("probe-decorator").getByTestId("probed")).toBeVisible();
    await page.goto(PLAIN);
    await expect(page.locator("iframe.forgebook-frame-view")).toBeVisible();
    await expect(frameOf(page).getByTestId("probe-decorator")).toHaveCount(0);
  });
});

test.describe("the Network tab", () => {
  test("lists a story's handlers and what answered its requests", async ({ page }) => {
    await page.goto(`${MOCKED}&tab=network`);
    await expect(frameOf(page).getByTestId("greeting")).toHaveText("Hello from a mock", {
      timeout: WORKER_START
    });
    await expect(page.getByText("GET /api/greeting")).toBeVisible();
    const row = page.getByRole("row", { name: /\/api\/greeting/ });
    await expect(row).toContainText("200");
    await expect(row).toContainText("Mocked");
    await expect(page.getByRole("tab", { name: /^Network/ })).toContainText("1");
  });

  test("is not offered to a story with no handlers", async ({ page }) => {
    await page.goto(story("sb:fetching-mocked--unmocked"));
    await expect(frameOf(page).getByTestId("greeting")).toHaveText("No answer");
    await expect(page.getByRole("tab", { name: /^Network/ })).toHaveCount(0);
  });
});
