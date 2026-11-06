/**
 * The catalogue with the keyboard alone, on the fixture app: every Tab stop of a page shows where the focus is, in both
 * appearances, and the main flow (find a story, open it, change its view and its props, go on to the next) never needs
 * the pointer.
 *
 * @remarks
 * A stop shows the focus when the element or a part around it looks different focused than not, read from what a
 * focus ring is drawn with. A frame is a stop too, but what shows there is the story's.
 *
 * @module
 */
import { expect, type JSHandle, type Locator, type Page, test } from "@playwright/test";

import { animationsDone } from "./shellAxe";

/** The most Tab presses a walk takes: more than any page of the fixture has stops. */
const MOST_STOPS = 150;

/** The address of a story of the fixture's Select. */
const STORY = "/?story=kit:inputs-selection-select--overview";

/** Waits until the shown story's frame says it is ready (or failed). */
const frameReady = async (page: Page): Promise<void> => {
  await expect(page.frameLocator("iframe.forgebook-frame-view").locator("html")).toHaveAttribute(
    "data-forgebook-status",
    /.+/,
    { timeout: 30_000 }
  );
};

/** What a focus ring is drawn with, on an element and the two parts around it, as one text. */
const lookOf = (element: JSHandle<Element | null>): Promise<string> =>
  element.evaluate((focused) => {
    const parts = [focused, focused?.parentElement, focused?.parentElement?.parentElement];
    return parts
      .map((part) => {
        if (part === null || part === undefined) return "";
        const style = getComputedStyle(part);
        return [
          style.outlineStyle,
          style.outlineWidth,
          style.outlineColor,
          style.boxShadow,
          style.backgroundColor,
          style.borderTopColor
        ].join(" ");
      })
      .join("|");
  });

/** What the walk reads about the element with the focus. */
type FocusStop = {
  /** A short name for the failure's message. */
  readonly name: string;
  /** Whether the focus has left the page's elements for the page itself. */
  readonly isLost: boolean;
  /** Whether it is on a frame, where what shows is the story's. */
  readonly isFrame: boolean;
  /** Whether its middle is inside the window and nothing lies over it. */
  readonly isInSight: boolean;
};

/** Reads the element with the focus, as it stands. */
const readStopNow = (element: JSHandle<Element | null>): Promise<FocusStop> =>
  element.evaluate((focused) => {
    if (focused === null || focused === document.body)
      return { name: "the page", isLost: true, isFrame: false, isInSight: false };
    const box = focused.getBoundingClientRect();
    const onTop = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return {
      name: `${focused.tagName.toLowerCase()} ${focused.getAttribute("aria-label") ?? focused.textContent?.slice(0, 40) ?? ""}`,
      isLost: false,
      isFrame: focused.tagName === "IFRAME",
      // a hidden radio's label lies over it, beside it in their parent
      isInSight:
        onTop !== null && (focused.parentElement?.contains(onTop) === true || onTop.contains(focused))
    };
  });

/**
 * Reads the element with the focus. Frames loading above it can move it after the browser brought it into view, so a
 * part out of sight is brought in once more: what still does not show has something lying over it.
 */
const readStop = async (element: JSHandle<Element | null>): Promise<FocusStop> => {
  const stop = await readStopNow(element);
  if (stop.isLost || stop.isInSight) return stop;
  await element.evaluate((focused) => focused?.scrollIntoView({ block: "nearest" }));
  return readStopNow(element);
};

/**
 * Walks a page's Tab stops from its start until the focus leaves the last one.
 *
 * @param page - the page, with nothing focused.
 * @returns the stops that show no focus, and how many stops there were.
 */
const walkTabStops = async (page: Page): Promise<{ readonly unseen: readonly string[]; count: number }> => {
  const unseen: string[] = [];
  let previous: { element: JSHandle<Element | null>; look: string; name: string } | undefined;
  let count = 0;
  for (let press = 0; press < MOST_STOPS; press += 1) {
    await page.keyboard.press("Tab");
    await animationsDone(page);
    const element = await page.evaluateHandle(() => document.activeElement);
    if (previous !== undefined && (await lookOf(previous.element)) === previous.look)
      unseen.push(previous.name);
    previous = undefined;
    const stop = await readStop(element);
    if (stop.isLost) return { unseen, count };
    count += 1;
    if (stop.isFrame) continue;
    if (!stop.isInSight) unseen.push(`${stop.name} (out of sight)`);
    previous = { element, look: await lookOf(element), name: stop.name };
  }
  return { unseen, count };
};

/**
 * Presses Tab until a part has the focus.
 *
 * @param page - the page.
 * @param part - the part to reach.
 * @param key - the key to press: Shift+Tab goes back.
 */
const tabTo = async (page: Page, part: Locator, key: "Tab" | "Shift+Tab" = "Tab"): Promise<void> => {
  for (let press = 0; press < MOST_STOPS; press += 1) {
    await page.keyboard.press(key);
    if (await part.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error(`Tab never reached ${part.toString()}`);
};

test.describe("the keyboard alone", () => {
  for (const colorScheme of ["light", "dark"] as const) {
    for (const [name, path] of [
      ["a story", STORY],
      ["a component", "/?component=kit:inputs-selection-select"],
      ["a docs page", "/?page=kit:getting-started"]
    ] as const) {
      test(`every Tab stop of ${name} shows the focus (${colorScheme})`, async ({ page }) => {
        test.slow();
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        await page.goto(path);
        await expect(page.locator(".forgebook-main")).toBeVisible();
        await page.waitForLoadState("networkidle");
        const { unseen, count } = await walkTabStops(page);
        expect(count).toBeGreaterThan(5);
        expect(unseen).toEqual([]);
      });
    }
  }

  test("what scrolls sideways takes a Tab stop only while it overflows", async ({ page }) => {
    await page.goto("/?page=kit:getting-started");
    const code = page.locator(".forgebook-docs__body pre").first();
    await expect(code).toBeVisible();
    await expect(code).not.toHaveAttribute("tabindex");
    await page.setViewportSize({ width: 360, height: 700 });
    await expect(page.locator(".forgebook-docs__body pre[tabindex='0']").first()).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(code).not.toHaveAttribute("tabindex");
  });

  test("finds a story, opens it, changes its view and its props, and goes on to the next", async ({
    page
  }) => {
    test.slow();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("searchbox")).toBeVisible();

    // the search's key, the words, the arrows and Enter open a story
    await page.keyboard.press("/");
    await expect(page.getByRole("searchbox")).toBeFocused();
    await page.keyboard.type("select overview");
    const results = page.getByRole("listbox", { name: "Search results" });
    await expect(results.getByRole("option").first()).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(results).toBeHidden();
    await expect(page).toHaveURL(/(story|component)=kit/);

    // the address is the page to walk from on: the rest of the flow is on a story's page
    await page.goto(STORY);
    await frameReady(page);

    // a popover opens with Enter, Tab goes into it, and Escape brings the focus back to its button
    const view = page.getByRole("button", { name: /^View/ });
    await tabTo(page, view);
    await page.keyboard.press("Enter");
    const viewMenu = page.getByRole("dialog", { name: "View" });
    await expect(viewMenu.getByRole("button", { name: "Reset to defaults" })).toBeVisible();
    await page.keyboard.press("Tab");
    await expect.poll(() => viewMenu.evaluate((menu) => menu.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(viewMenu).toBeHidden();
    await expect(view).toBeFocused();

    // Compare opens, a choice is taken with the arrows and the space bar
    const compare = page.getByRole("button", { name: "Compare" });
    await tabTo(page, compare);
    await page.keyboard.press("Enter");
    const compareMenu = page.getByRole("dialog", { name: "Compare" });
    await expect(compareMenu.getByRole("radio", { checked: true })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page).toHaveURL(/compare=/);
    await page.keyboard.press("Escape");
    await expect(compareMenu).toBeHidden();
    await expect(compare).toBeFocused();
    await page.goto(STORY);
    await frameReady(page);

    // the panel's tabs move with the arrows; a prop's field takes what is typed, and the address keeps it
    const tabs = page.getByRole("tablist", { name: "Panel" }).getByRole("tab");
    const propsTab = page.getByRole("tab", { name: "Props" });
    await tabTo(page, propsTab);
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(propsTab).toHaveAttribute("aria-selected", "true");
    const field = page.locator(".forgebook-dock__body input[type='text']").first();
    await tabTo(page, field);
    await page.keyboard.type("Typed");
    await expect(page).toHaveURL(/args=/);
    await expect(field).toHaveValue(/Typed/);

    // the sidebar goes and comes back, the focus following
    await tabTo(page, page.getByRole("button", { name: "Hide the sidebar" }), "Shift+Tab");
    await page.keyboard.press("Enter");
    const show = page.getByRole("button", { name: "Show the sidebar" });
    await expect(show).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Hide the sidebar" })).toBeFocused();

    // the appearance is reached from the sidebar, picked with the arrows: the one before the system's
    const appearance = page.getByRole("button", { name: /^Appearance/ });
    await tabTo(page, appearance);
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("dialog", { name: "Appearance" }).getByRole("radio", { checked: true })
    ).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("button", { name: /^Appearance: Dark/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /^Appearance: Dark/ })).toBeFocused();

    // the keys of the story list open the next story and come back
    const address = page.url();
    await page.keyboard.press("]");
    await expect(page).not.toHaveURL(address);
  });
});
