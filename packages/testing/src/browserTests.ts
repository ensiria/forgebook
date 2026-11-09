/**
 * One Playwright test per story and variant, on the catalogue's frame pages: the address the catalogue shows is the
 * address the tests open.
 *
 * @remarks
 * Each test opens the frame for a story in a variant (the theme, the contrast, the style sheets), waits for the
 * frame to say the story is shown (`data-forgebook-status`), its story clock held at its start, and fails on an error in the console or the page, or on
 * an axe violation of WCAG 2.2 A and AA, on an element that spills out of its parent (`forgebook/spills`: what overlaps a
 * neighbour when the story is narrower than it was drawn for), on an overlay its play leaves open past the frame the
 * catalogue would give it (`overlays.ts`: the story then declares `parameters.height`), or on the source's own
 * `check`. The variants include a
 * narrow frame, as wide as the catalogue's stage beside the props panel. With `screenshot` it compares the frame with its reference image instead,
 * for the visual tests, which run in the Playwright container so fonts and rendering are the same everywhere.
 * A story about logic (`parameters.logic`) is tested once, in the default view, without the layout checks, and never
 * pictured (`storyTestPlan.ts`).
 *
 * @module
 */
import { existsSync } from "node:fs";

import { expect, type Page, test } from "@playwright/test";
import { type A11ySettings, type CatalogueLists, catalogueSettings } from "forgebook/catalogue";
import { PENDING_REASON_ATTRIBUTE, STATUS_ATTRIBUTE } from "forgebook/frame-status";
import type { StoryProblem } from "forgebook/story-check";
import { heldClockAddress } from "forgebook/story-clock";
import { formerStoryId, storyTree, testedStoryLocations } from "forgebook/story-tree";
import { DEFAULT_SWITCHES, switchWithRole, type ViewSwitch } from "forgebook/switches";
import { defaultView, frameAddress, type ViewState } from "forgebook/view-state";

import { isOverlayChecked } from "./overlays.ts";
import {
  axeProblems,
  missingFileWarnings,
  overlayProblems,
  type PageFindings,
  spillProblems,
  watchedErrors
} from "./storyCheck.ts";
import { indexedSource, type StoryFilesOptions } from "./storyFiles.ts";
import { logicVariantOf, type PlannedStoryTest, plannedStoryTests } from "./storyTestPlan.ts";

/**
 * Says a test's missing static files in its report, as `warning` annotations: a missing image or font does not fail the
 * test, since the story still runs.
 *
 * @param findings - what the page's watch found.
 */
const annotateMissingFiles = (findings: PageFindings): void => {
  for (const warning of missingFileWarnings(findings).warnings ?? [])
    test.info().annotations.push({ type: "warning", description: warning.message });
};

/**
 * How long a test waits for a frame's answer, in ms: past the 10 s a frame waits by default for what its story loads and
 * the same again after its play, so that wait ends as the frame's own `pending`, and short of the 30 s a test may take.
 */
const FRAME_ANSWER_MS = 25_000;

/** One way of showing every story. */
export type StoryVariant = {
  /** The variant's name, in the test's title and the reference image's name. */
  readonly name: string;
  /**
   * What it sets over the defaults: switches' values, the style sheets, the text size; never the backdrop, since
   * every test draws the story on its page's colour.
   */
  readonly view: Partial<Omit<ViewState, "backdrop">>;
  /** The frame's width in CSS px; the test browser's default when none. */
  readonly width?: number;
};

/** The narrow variant's width: about the catalogue's stage beside the props panel in a laptop window, in CSS px. */
export const NARROW_WIDTH = 560;

/**
 * The variants every story is tested in, from the catalogue's switches: each scheme of its colour scheme switch (the
 * system's left out, it draws one of them), each at more contrast when it has a contrast switch (`dark-more`), then the
 * first scheme with the structure only, and in a narrow frame.
 *
 * @param switches - the catalogue's switches.
 */
export const storyVariants = (switches: readonly ViewSwitch[]): StoryVariant[] => {
  const scheme = switchWithRole(switches, "colorScheme");
  const contrast = switchWithRole(switches, "contrast");
  const more = contrast?.values.find((value) => value.isMore === true);
  const schemes = (scheme?.values ?? []).filter((value) => value.isUnset !== true);
  const schemeView = (value: string | undefined): Readonly<Record<string, string>> =>
    scheme === undefined || value === undefined ? {} : { [scheme.id]: value };
  const first = schemeView(schemes[0]?.value);
  const named = schemes.length > 0 ? schemes : [undefined];
  return [
    ...named.map((value) => ({
      name: value?.value ?? "default",
      view: { switches: schemeView(value?.value) }
    })),
    ...(contrast === undefined || more === undefined
      ? []
      : named.map((value) => ({
          name: `${value?.value ?? "default"}-more`,
          view: { switches: { ...schemeView(value?.value), [contrast.id]: more.value } }
        }))),
    { name: "structure", view: { switches: first, sheets: "structure" } },
    { name: "narrow", view: { switches: first }, width: NARROW_WIDTH }
  ];
};

/** The variants of a catalogue with the default switches: light, dark, both at more contrast, structure, narrow. */
export const STORY_VARIANTS: readonly StoryVariant[] = storyVariants(DEFAULT_SWITCHES);

/** The generated tests' options. */
export type StoryBrowserTestsOptions = StoryFilesOptions & {
  /** The frame page, relative to the test's `baseURL`; `frame.html` by default. */
  readonly frameUrl?: string;
  /** The catalogue's switches, as the frame page's configuration gives them; the theme and the contrast by default. */
  readonly switches?: readonly ViewSwitch[];
  /** The catalogue's lists, as its configuration gives them: its accessibility rules, backgrounds, text sizes. */
  readonly lists?: CatalogueLists;
  /** The variants; `storyVariants` of the switches by default. */
  readonly variants?: readonly StoryVariant[];
  /** Compare each frame with its reference image instead of running the checks; `false` by default. */
  readonly screenshot?: boolean;
  /**
   * A check of the source's own, run on every story's frame after axe (a rule of its components that axe does not
   * know); it fails the test with Playwright's `expect`. None by default; skipped with `screenshot`.
   */
  readonly check?: (page: Page) => Promise<void>;
};

/** A problem list's messages, so a failing test names each problem. */
const messages = (problems: readonly StoryProblem[]): string[] => problems.map((problem) => problem.message);

/**
 * Runs the checks of one planned test on a shown story: axe (unless the catalogue checks no accessibility), then for a
 * story about its looks the spills, the source's own check, and the overlays last (it resizes the window, which may
 * close what the story left open). A story about logic gets axe only.
 *
 * @param page - the story's frame, ready.
 * @param planned - the story, its variant and whether its layout is checked.
 * @param a11y - the catalogue's accessibility rules; none when it checks no accessibility (`a11y: false`).
 * @param check - the source's own check, if any.
 */
const expectChecksPass = async (
  page: Page,
  planned: PlannedStoryTest,
  a11y: A11ySettings | undefined,
  check: ((page: Page) => Promise<void>) | undefined
): Promise<void> => {
  if (a11y !== undefined) expect(messages(await axeProblems(page, a11y))).toEqual([]);
  if (!planned.hasLookChecks) return;
  expect(messages(await spillProblems(page))).toEqual([]);
  await check?.(page);
  expect(
    messages(await overlayProblems(page, isOverlayChecked(planned.variant.view), planned.story.height))
  ).toEqual([]);
};

/**
 * A story's screenshot name in a variant: by its id, or by the id an earlier rule gave it while only a screenshot of
 * that name is stored, so the screenshots taken before the ids followed Storybook's keep comparing.
 *
 * @param id - the story's id.
 * @param formerId - the id the former rule gave it.
 * @param variant - the variant's name.
 */
const screenshotName = (id: string, formerId: string, variant: string): string => {
  const named = (storyId: string): string => `${storyId.replace(":", "--")}--${variant}.png`;
  const isStored = (name: string): boolean =>
    existsSync(test.info().snapshotPath(name, { kind: "screenshot" }));
  return named(formerId) !== named(id) && !isStored(named(id)) && isStored(named(formerId))
    ? named(formerId)
    : named(id);
};

/**
 * Declares the tests, one `describe` per component and one test per story and variant.
 *
 * @param options - where the stories are, the frame page, the variants, whether to compare screenshots, and a check of
 * the source's own.
 */
export const storyBrowserTests = (options: StoryBrowserTestsOptions): void => {
  const { frameUrl = "frame.html", switches = DEFAULT_SWITCHES, screenshot = false, check } = options;
  const variants = options.variants ?? storyVariants(switches);
  const catalogue = catalogueSettings("", switches, options.lists);
  const defaults = defaultView(catalogue);
  const source = indexedSource(options);
  const tree = storyTree([source]);
  const groups = Map.groupBy(testedStoryLocations(tree), (location) => location.component.title);
  for (const [title, locations] of groups) {
    const planned = plannedStoryTests(
      locations.map((location) => location.story),
      variants,
      screenshot,
      logicVariantOf(options.variants)
    );
    // a component whose stories are all about logic has nothing to picture
    if (planned.length === 0) continue;
    test.describe(title, () => {
      for (const { story, variant, hasLookChecks } of planned) {
        test(`${story.name} · ${variant.name}`, async ({ page }) => {
          const watched = watchedErrors(page);
          if (variant.width !== undefined) await page.setViewportSize({ width: variant.width, height: 800 });
          // a Live story is checked and pictured at its start: its clock held, so its image never changes;
          // always on its page's own colour, whatever a variant names: a backdrop is for looking
          const view: ViewState = {
            ...defaults,
            ...variant.view,
            switches: { ...defaults.switches, ...variant.view.switches },
            backdrop: "plain"
          };
          await page.goto(heldClockAddress(frameAddress(frameUrl, story.id, view, switches)));
          // past the wait of a frame for what its story loads, then `ready` or the frame's own reason
          await expect(page.locator("html")).toHaveAttribute(STATUS_ATTRIBUTE, /^(?:ready|error|pending)$/, {
            timeout: FRAME_ANSWER_MS
          });
          expect(
            await page.locator("html").getAttribute(STATUS_ATTRIBUTE),
            (await page.locator("html").getAttribute(PENDING_REASON_ATTRIBUTE)) ?? "the frame's status"
          ).toBe("ready");
          if (screenshot) {
            const name = screenshotName(
              story.id,
              formerStoryId(source.id, title, story.exportName),
              variant.name
            );
            await expect(page).toHaveScreenshot(name, {
              fullPage: true,
              animations: "disabled"
            });
            return;
          }
          await expectChecksPass(page, { story, variant, hasLookChecks }, catalogue.a11y, check);
          const findings = watched();
          annotateMissingFiles(findings);
          expect(findings.errors).toEqual([]);
        });
      }
    });
  }
};
