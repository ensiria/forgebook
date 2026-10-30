/**
 * One Playwright test per story and variant, on the catalogue's frame pages: the address the catalogue shows is the
 * address the tests open (D-56, D-69).
 *
 * @remarks
 * Each test opens the frame for a story in a variant (the theme, the contrast, the style sheets), waits for the
 * frame to say the story is shown (`data-forgebook-status`), its story clock held at its start (D-504), and fails on an error in the console or the page, or on
 * an axe violation of WCAG 2.2 A and AA, on an element that spills out of its parent (`spills.ts`: what overlaps a
 * neighbour when the story is narrower than it was drawn for), on an overlay its play leaves open past the frame the
 * catalogue would give it (`overlays.ts`: the story then declares `parameters.height`, D-469), or on the source's own
 * `check`. The variants include a
 * narrow frame, as wide as the catalogue's stage beside the props panel. With `screenshot` it compares the frame with its reference image instead,
 * for the visual tests, which run in the Playwright container so fonts and rendering are the same everywhere.
 *
 * @module
 */
import { AxeBuilder } from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { AXE_TAGS } from "forgebook/a11y";
import { STATUS_ATTRIBUTE } from "forgebook/frame-status";
import { heldClockAddress } from "forgebook/story-clock";
import { storyLocations, storyTree } from "forgebook/story-tree";
import { DEFAULT_VIEW, frameAddress, type ViewState } from "forgebook/view-state";

import { findOverlaysPastFrame, isOverlayChecked } from "./overlays";
import { findSpills } from "./spills";
import { indexedSource, type StoryFilesOptions } from "./storyFiles";

/** One way of showing every story. */
export type StoryVariant = {
  /** The variant's name, in the test's title and the reference image's name. */
  readonly name: string;
  /** The switches it sets over the defaults; never the backdrop: every test draws the story on its page's colour. */
  readonly view: Partial<Omit<ViewState, "backdrop">>;
  /** The frame's width in CSS px; the test browser's default when none. */
  readonly width?: number;
};

/** The narrow variant's width: about the catalogue's stage beside the props panel in a laptop window, in CSS px. */
export const NARROW_WIDTH = 560;

/** The variants every story is tested in: the four themes, the structure only, and a narrow frame. */
export const STORY_VARIANTS: readonly StoryVariant[] = [
  { name: "light", view: { theme: "light" } },
  { name: "dark", view: { theme: "dark" } },
  { name: "light-more", view: { theme: "light", isMoreContrast: true } },
  { name: "dark-more", view: { theme: "dark", isMoreContrast: true } },
  { name: "structure", view: { theme: "light", sheets: "structure" } },
  { name: "narrow", view: { theme: "light" }, width: NARROW_WIDTH }
];

/** The generated tests' options. */
export type StoryBrowserTestsOptions = StoryFilesOptions & {
  /** The frame page, relative to the test's `baseURL`; `frame.html` by default. */
  readonly frameUrl?: string;
  /** The variants; `STORY_VARIANTS` by default. */
  readonly variants?: readonly StoryVariant[];
  /** Compare each frame with its reference image instead of running the checks; `false` by default. */
  readonly screenshot?: boolean;
  /**
   * A check of the source's own, run on every story's frame after axe (a rule of its components that axe does not
   * know); it fails the test with Playwright's `expect`. None by default; skipped with `screenshot`.
   */
  readonly check?: (page: Page) => Promise<void>;
};

/**
 * The overlays a story's play leaves open past its frame, as the test's messages; none in a view that is not checked
 * (`isOverlayChecked`).
 *
 * @param page - the story's frame page, its play over.
 * @param variant - the variant the test shows the story in.
 * @param sceneHeight - the height the story declares, in CSS px, if any.
 * @returns one message per overlay past the frame.
 */
const overlayProblems = async (
  page: Page,
  variant: StoryVariant,
  sceneHeight: number | undefined
): Promise<string[]> => {
  if (!isOverlayChecked(variant.view)) return [];
  const overlays = await findOverlaysPastFrame(page, sceneHeight);
  return overlays.map(
    (overlay) =>
      `${overlay.element} ends ${overlay.by}px below the frame's ${overlay.frameHeight}px: declare parameters.height`
  );
};

/**
 * Declares the tests, one `describe` per component and one test per story and variant.
 *
 * @param options - where the stories are, the frame page, the variants, whether to compare screenshots, and a check of
 * the source's own.
 */
export const storyBrowserTests = (options: StoryBrowserTestsOptions): void => {
  const { frameUrl = "frame.html", variants = STORY_VARIANTS, screenshot = false, check } = options;
  const tree = storyTree([indexedSource(options)]);
  const groups = Map.groupBy(storyLocations(tree), (location) => location.component.title);
  for (const [title, locations] of groups) {
    test.describe(title, () => {
      for (const { story } of locations) {
        for (const variant of variants) {
          test(`${story.name} · ${variant.name}`, async ({ page }) => {
            const errors: string[] = [];
            page.on("pageerror", (error) => errors.push(error.message));
            page.on("console", (message) => {
              if (message.type() === "error") errors.push(message.text());
            });
            if (variant.width !== undefined)
              await page.setViewportSize({ width: variant.width, height: 800 });
            // a Live story is checked and pictured at its start: its clock held, so its image never changes (D-504);
            // always on its page's own colour, whatever a variant names: a backdrop is for looking (D-644, D-653)
            const view: ViewState = { ...DEFAULT_VIEW, ...variant.view, backdrop: "plain" };
            await page.goto(heldClockAddress(frameAddress(frameUrl, story.id, view)));
            await expect(page.locator("html")).toHaveAttribute(STATUS_ATTRIBUTE, "ready");
            if (screenshot) {
              await expect(page).toHaveScreenshot(`${story.id.replace(":", "--")}--${variant.name}.png`, {
                fullPage: true,
                animations: "disabled"
              });
              return;
            }
            const { violations } = await new AxeBuilder({ page }).withTags([...AXE_TAGS]).analyze();
            expect(violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
            const spills = await page.evaluate(findSpills, ".forgebook-frame");
            expect(
              spills.map((spill) => `${spill.element} spills out of ${spill.parent} by ${spill.by}px`)
            ).toEqual([]);
            await check?.(page);
            // last: it resizes the window, which may close what the story left open
            expect(await overlayProblems(page, variant, story.height)).toEqual([]);
            expect(errors).toEqual([]);
          });
        }
      }
    });
  }
};
