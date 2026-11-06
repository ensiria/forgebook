/**
 * axe over the shell's screens and open states, in both appearances, on the fixture app; the stories in their frames
 * are left out (`shellAxe.ts`).
 *
 * @remarks
 * A new screen, panel or menu of the shell gets its state in `STATES`. A finding is fixed; one too big for now goes in
 * `EXCEPTIONS` with its reason, and a rule is never turned off.
 *
 * @module
 */
import { expect, type Locator, type Page, test } from "@playwright/test";

import { catalogueUrl } from "./ports";
import { type AxeException, animationsDone, scanShell, unexcused } from "./shellAxe";

/** How long a page waits for what the docs worker or the search index answers on a cold dev server. */
const SLOW_ANSWER = { timeout: 30_000 };

/** The address of a story of the fixture's Select. */
const story = (name: string, query = ""): string =>
  `/?story=kit:inputs-selection-select--${name}${query === "" ? "" : `&${query}`}`;

/** Waits until the shown story's frame says it is ready (or failed). */
const frameReady = async (page: Page): Promise<void> => {
  await expect(page.frameLocator("iframe.forgebook-frame-view").first().locator("html")).toHaveAttribute(
    "data-forgebook-status",
    /.+/,
    SLOW_ANSWER
  );
};

/** The window of a phone. */
const PHONE = { width: 360, height: 700 };

/**
 * A window as tall as a long page: axe leaves undecided the contrast of what a scrolling part keeps out of sight, so
 * the longest pages are also checked whole.
 */
const WHOLE_PAGE = { width: 1280, height: 7000 };

/** A state of the shell to check. */
type ShellState = {
  /** Its name, in the test's title and in `EXCEPTIONS`. */
  readonly name: string;
  /** The window, when not the suite's. */
  readonly viewport?: { readonly width: number; readonly height: number };
  /** Brings the page to the state. */
  readonly open: (page: Page) => Promise<void>;
};

/** A page, once something on it shows. */
const pageWith =
  (path: string, ready: (page: Page) => Locator) =>
  async (page: Page): Promise<void> => {
    await page.goto(path);
    await expect(ready(page)).toBeVisible(SLOW_ANSWER);
  };

/** A story's page, with its frame ready. */
const storyPage = async (page: Page, path: string): Promise<void> => {
  await page.goto(path);
  await frameReady(page);
};

/** A story's page with one of its panel's tabs open. */
const panelTab =
  (tab: string, path = story("overview")) =>
  async (page: Page): Promise<void> => {
    await storyPage(page, path);
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
    await page.waitForLoadState("networkidle");
  };

/** The search with its list open on these words. */
const searched =
  (words: string, shown: (page: Page) => Locator) =>
  async (page: Page): Promise<void> => {
    await page.goto("/");
    await page.getByRole("searchbox").fill(words);
    await expect(shown(page)).toBeVisible(SLOW_ANSWER);
  };

/** A story's page with a toolbar's popover open. */
const popover =
  (button: string | RegExp, dialog: string) =>
  async (page: Page): Promise<void> => {
    await storyPage(page, story("overview"));
    await page.getByRole("button", { name: button }).first().click();
    await expect(page.getByRole("dialog", { name: dialog })).toBeVisible();
    await page.waitForLoadState("networkidle");
  };

/** The states the shell can stand in. */
const STATES: readonly ShellState[] = [
  { name: "home", open: pageWith("/", (page) => page.locator(".forgebook-home__families").last()) },
  {
    name: "component page",
    open: pageWith("/?component=kit:inputs-selection-select", (page) =>
      page.locator(".forgebook-api__subcomponent").first()
    )
  },
  {
    name: "component page, whole",
    viewport: WHOLE_PAGE,
    open: pageWith("/?component=kit:inputs-selection-select", (page) =>
      page.locator(".forgebook-api__subcomponent").first()
    )
  },
  {
    name: "docs page",
    open: pageWith("/?page=kit:getting-started", (page) => page.locator(".forgebook-docs__body pre").first())
  },
  {
    name: "docs page with blocks",
    open: pageWith("/?page=kit:blocks", (page) =>
      page.locator(".forgebook-docs__body .forgebook-tabs").first()
    )
  },
  {
    name: "docs page with blocks, whole",
    viewport: WHOLE_PAGE,
    open: pageWith("/?page=kit:blocks", (page) =>
      page.locator(".forgebook-docs__body .forgebook-tabs").first()
    )
  },
  {
    name: "home, whole",
    viewport: WHOLE_PAGE,
    open: pageWith("/", (page) => page.locator(".forgebook-home__families").last())
  },
  {
    name: "page not found",
    open: pageWith("/?story=kit:nowhere", (page) => page.locator(".forgebook-main"))
  },
  { name: "story with the props panel", open: panelTab("Props") },
  { name: "story with its code", open: panelTab("Code") },
  { name: "story with its events", open: panelTab("Events") },
  { name: "story with its accessibility check", open: panelTab("Accessibility") },
  { name: "story with its interactions", open: panelTab("Interactions", story("played")) },
  { name: "story with a typed width", open: (page) => storyPage(page, story("overview", "width=500")) },
  { name: "story that throws", open: (page) => storyPage(page, story("throws")) },
  {
    name: "story on a device",
    open: (page) => storyPage(page, story("overview", "forgebook.device=pixel-9"))
  },
  {
    name: "hidden sidebar",
    open: async (page) => {
      await storyPage(page, story("overview"));
      await page.getByRole("button", { name: "Hide the sidebar" }).click();
      await expect(page.getByRole("button", { name: "Show the sidebar" })).toBeVisible();
    }
  },
  { name: "compare view", open: (page) => storyPage(page, story("overview", "compare=theme")) },
  {
    name: "sidebar with search results",
    open: searched("select", (page) => page.getByRole("listbox", { name: "Search results" }))
  },
  {
    name: "sidebar with nothing found",
    open: searched("zzzqqq", (page) => page.getByRole("status").filter({ hasText: "Nothing found" }))
  },
  { name: "View menu", open: popover(/^View/, "View") },
  { name: "Compare menu", open: popover("Compare", "Compare") },
  { name: "Embed dialog", open: popover("Embed this story", "Embed this story") },
  { name: "Interface menu", open: popover(/^Interface/, "Interface") },
  {
    name: "a gallery's menu",
    open: async (page) => {
      await storyPage(page, `${catalogueUrl("themes")}?story=kit:inputs-selection-select--overview`);
      await page.getByRole("button", { name: "Theme: Plain" }).click();
      await expect(
        page.getByRole("dialog", { name: "Theme" }).getByRole("radio", { checked: true })
      ).toBeFocused();
    }
  },
  {
    name: "a control's menu",
    open: async (page) => {
      await storyPage(page, story("overview"));
      await page.locator('.forgebook-toolbar__pinned[data-control="contrast"]').click({ button: "right" });
      await expect(page.getByRole("menu", { name: "More contrast on the toolbar" })).toBeVisible();
    }
  },
  {
    name: "a control's note",
    open: async (page) => {
      await popover(/^View/, "View")(page);
      await page.getByRole("dialog", { name: "View" }).locator(".forgebook-info-tip").first().focus();
      await expect(page.getByRole("tooltip").first()).toBeVisible();
    }
  },
  {
    name: "example over the page",
    open: async (page) => {
      await page.goto("/?component=kit:inputs-selection-select");
      const overview = page.getByRole("article", { name: "Overview", exact: true });
      await overview.scrollIntoViewIfNeeded();
      await expect(overview.frameLocator("iframe").locator("html")).toHaveAttribute(
        "data-forgebook-status",
        /.+/,
        SLOW_ANSWER
      );
      await overview.getByRole("button", { name: "Fill the page with Overview" }).click();
      await expect(page.getByRole("dialog", { name: "Overview" })).toBeVisible();
    }
  },
  {
    name: "narrow home",
    viewport: PHONE,
    open: pageWith("/", (page) => page.locator(".forgebook-home__families").last())
  },
  {
    name: "narrow story",
    viewport: PHONE,
    open: (page) => storyPage(page, story("small"))
  },
  {
    name: "narrow docs page",
    viewport: PHONE,
    open: pageWith("/?page=kit:getting-started", (page) => page.locator(".forgebook-docs__body pre").first())
  },
  {
    name: "narrow component page",
    viewport: PHONE,
    open: pageWith("/?component=kit:inputs-selection-select", (page) =>
      page.locator(".forgebook-api__subcomponent").first()
    )
  },
  {
    name: "narrow docs page with blocks",
    viewport: PHONE,
    open: pageWith("/?page=kit:blocks", (page) =>
      page.locator(".forgebook-docs__body .forgebook-tabs").first()
    )
  },
  {
    name: "narrow signature of a hook",
    viewport: PHONE,
    open: pageWith("/?component=kit:hooks-use-undo", (page) => page.locator(".forgebook-signature__call"))
  },
  {
    name: "narrow story with its code",
    viewport: PHONE,
    open: panelTab("Code", story("small"))
  },
  {
    name: "narrow sidebar over the page",
    viewport: PHONE,
    open: async (page) => {
      await storyPage(page, story("small"));
      await page.getByRole("button", { name: "Show the sidebar" }).click();
      await expect(page.locator(".forgebook-sidebar")).toBeInViewport({ ratio: 1 });
    }
  },
  {
    name: "narrow sidebar with search results",
    viewport: PHONE,
    open: async (page) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Show the sidebar" }).click();
      await page.getByRole("searchbox").fill("select");
      await expect(page.getByRole("listbox", { name: "Search results" })).toBeVisible(SLOW_ANSWER);
    }
  }
];

/** The findings too big for now. */
const EXCEPTIONS: readonly AxeException[] = [];

test.describe("axe over the shell", () => {
  test("sees what is wrong in the shell, and nothing of a story's frame", async ({ page }) => {
    const unnamedImage = (): void => {
      document.body.append(document.createElement("img"));
    };
    await storyPage(page, story("overview"));
    const frame = page.frames().find((each) => each !== page.mainFrame());
    expect(frame).toBeDefined();
    await frame?.evaluate(unnamedImage);
    expect((await scanShell(page)).filter((finding) => finding.rule === "image-alt")).toEqual([]);
    await page.evaluate(unnamedImage);
    expect((await scanShell(page)).map((finding) => finding.rule)).toContain("image-alt");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    for (const { name, viewport, open } of STATES) {
      test(`${name} (${colorScheme})`, async ({ page }) => {
        test.slow();
        if (viewport !== undefined) await page.setViewportSize(viewport);
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        await open(page);
        await expect(page.locator("html")).toHaveAttribute("data-forgebook-appearance", colorScheme);
        await animationsDone(page);
        const left = unexcused(name, await scanShell(page), EXCEPTIONS);
        expect(left.findings).toEqual([]);
        expect(left.stale).toEqual([]);
      });
    }
  }
});
