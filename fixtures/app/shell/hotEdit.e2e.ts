/**
 * A story file edited while its story is open: the frame draws the edit in place, and what the reader did in the story
 * stays; an edit of the file a story file re-exports its stories from is drawn the same way, and the panel shows it.
 *
 * @remarks
 * The tests edit committed fixture files through `fileEdits`, which puts their bytes back whatever happens, and run in
 * the configuration's `story file edits` project, one at a time: no other test, repetition or spec sees a file while
 * it holds an edit. So the hot-edit stories are checked ready here, not with the other Storybook files.
 *
 * @module
 */
import { fileURLToPath } from "node:url";

import { expect, type FrameLocator, type Page } from "@playwright/test";

import { test } from "./fileEdits";

/** The story file that writes its story. */
const OWN_FILE = fileURLToPath(new URL("../../storybook/src/HotEdit.stories.tsx", import.meta.url));

/** The file the story file re-exports a story from. */
const BEHIND_FILE = fileURLToPath(
  new URL("../../storybook/reexported/HotEditBehind.stories.tsx", import.meta.url)
);

/** The address of a story of the hot-edit file. */
const story = (name: string, query = ""): string =>
  `/?story=sb:storybook-hot-edit--${name}${query === "" ? "" : `&${query}`}`;

/** The shown story's frame. */
const frameOf = (page: Page): FrameLocator => page.frameLocator("iframe.forgebook-frame-view");

/**
 * Replaces a text the original file must hold, so an edit that no longer applies fails instead of writing nothing.
 *
 * @param from - the text the file holds.
 * @param to - the text written in its place.
 */
const replacing =
  (from: string, to: string) =>
  (original: string): string => {
    expect(original).toContain(from);
    return original.replace(from, to);
  };

test("every story of the hot-edit file is ready in its frame, without a page error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const name of ["own", "behind"]) {
    await page.goto(`/frame.html?story=sb:storybook-hot-edit--${name}`);
    await expect(page.locator("html")).toHaveAttribute("data-forgebook-status", "ready");
  }
  expect(errors).toEqual([]);
});

test("draws the edit in place: the text typed in the story stays, and Code shows the edit", async ({
  page,
  fileEdits
}) => {
  await page.goto(story("own", "tab=code"));
  const field = frameOf(page).getByLabel("Note");
  await field.fill("typed before the edit");
  await fileEdits.write(OWN_FILE, replacing('"Written here"', '"Edited here"'));
  await expect(frameOf(page).getByText("Edited here")).toBeVisible();
  await expect(field).toHaveValue("typed before the edit");
  await expect(page.locator(".forgebook-code-block")).toContainText('label="Edited here"');
});

test("draws the fix of an edit that threw while the file loaded", async ({ page, fileEdits }) => {
  await page.goto(story("own"));
  await expect(frameOf(page).getByText("Written here")).toBeVisible();
  // the broken version reports its error and leaves the story drawn
  const reported = page.waitForEvent("console", (message) => message.text().includes("half typed"));
  await fileEdits.write(
    OWN_FILE,
    replacing("export default meta;", 'throw new Error("half typed");\nexport default meta;')
  );
  await reported;
  await expect(frameOf(page).getByText("Written here")).toBeVisible();
  // the fix is drawn in place
  await fileEdits.write(OWN_FILE, replacing('"Written here"', '"Fixed here"'));
  await expect(frameOf(page).getByText("Fixed here")).toBeVisible();
});

test("draws an edit of the file its story is re-exported from, and keeps the text typed in it", async ({
  page,
  fileEdits
}) => {
  await page.goto(story("behind"));
  const field = frameOf(page).getByLabel("Note");
  await field.fill("typed before the edit");
  await fileEdits.write(BEHIND_FILE, replacing('"Written behind a re-export"', '"Edited behind"'));
  await expect(frameOf(page).getByText("Edited behind")).toBeVisible();
  await expect(field).toHaveValue("typed before the edit");
});
