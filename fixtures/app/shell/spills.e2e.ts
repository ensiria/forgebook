/**
 * The spill finder on real layout (`forgebook/spills`, what `@forgebook/testing`'s checks and the frame's outline run):
 * the white space a line ends with at a soft wrap hangs past the line under `pre-wrap` and draws nothing, so it is no
 * spill, while a word, an inline box or an image past the edge still is. Each case is a page of its own, sized in `ch`
 * of a monospace font, so the lines break where the test says.
 *
 * @module
 */
import { expect, type Page, test } from "@playwright/test";
import { findSpills, type Spill } from "forgebook/spills";

/** A paragraph twenty characters wide, as a contenteditable editor draws its text. */
const paragraph = (whiteSpace: string, inner: string): string =>
  `<div class="root"><p style="width: 20ch; margin: 0; font: 16px/1.5 monospace; white-space: ${whiteSpace}">${inner}</p></div>`;

/** The spills of a page made of some markup. */
const spillsOf = async (page: Page, markup: string): Promise<Spill[]> => {
  await page.setContent(
    `<!doctype html><html><body style="margin: 0; padding: 40px">${markup}</body></html>`
  );
  return page.evaluate(findSpills, ".root");
};

/** Twenty letters: a line exactly full, so the space after them is the one that hangs. */
const FULL_LINE = "a".repeat(20);

test.describe("the spill finder", () => {
  test("passes a span whose wrapped line ends in a space that hangs under pre-wrap", async ({ page }) => {
    const spills = await spillsOf(
      page,
      paragraph("pre-wrap", `<span data-style="small-caps">${FULL_LINE} board</span>`)
    );
    expect(spills).toEqual([]);
  });

  test("still reports the same span when a word runs past the edge", async ({ page }) => {
    const spills = await spillsOf(page, paragraph("pre-wrap", `<span>${"a".repeat(25)} board</span>`));
    expect(spills).toEqual([{ element: "span", parent: "p", by: expect.any(Number) }]);
    expect(spills[0]?.by).toBeGreaterThan(30);
  });

  test("passes break-spaces, where the space wraps to the next line instead of hanging", async ({ page }) => {
    expect(await spillsOf(page, paragraph("break-spaces", `<span>${FULL_LINE} board</span>`))).toEqual([]);
  });

  test("still reports an inline image and an inline box past the edge", async ({ page }) => {
    const image = `<img alt="" width="300" height="8" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">`;
    const box = `<span style="display: inline-block; width: 30ch">x</span>`;
    const spills = await spillsOf(page, paragraph("pre-wrap", `${image}<br>${box}`));
    expect(spills.map((spill) => spill.element)).toEqual(["img", "span"]);
  });

  test("reports a span past the edge whose word is inside an element of its own", async ({ page }) => {
    const spills = await spillsOf(page, paragraph("pre-wrap", `<span><b>${"a".repeat(25)}</b> </span>`));
    // the span reaches as far as its word; the word stays inside the span, which is its parent
    expect(spills.map((spill) => spill.element)).toEqual(["span"]);
  });
});
