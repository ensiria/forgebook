/**
 * A story file edited while its story is open: the frame draws the edit in place, and what the reader did in the story
 * stays; an edit of the file a story file re-exports its stories from is drawn the same way, and the panel shows it.
 *
 * @remarks
 * Each test writes a fixture file and puts it back as it found it, whatever happens: the other tests read the same
 * files.
 *
 * @module
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, type FrameLocator, type Page, test } from "@playwright/test";

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
 * Runs a check while a file holds one text in place of another, and puts the file back after.
 *
 * @param file - the file.
 * @param from - the text it holds.
 * @param to - the text it holds meanwhile.
 * @param check - what runs meanwhile.
 */
const whileEdited = async (
  file: string,
  from: string,
  to: string,
  check: () => Promise<void>
): Promise<void> => {
  const text = readFileSync(file, "utf8");
  expect(text).toContain(from);
  writeFileSync(file, text.replace(from, to));
  try {
    await check();
  } finally {
    writeFileSync(file, text);
  }
};

test.describe("a story file edited while its story is open", () => {
  // one at a time: a test that ran twice at once would edit the same file under itself
  test.describe.configure({ mode: "serial" });

  test("draws the edit in place: the text typed in the story stays, and Code shows the edit", async ({
    page
  }) => {
    await page.goto(story("own", "tab=code"));
    const field = frameOf(page).getByLabel("Note");
    await field.fill("typed before the edit");
    await whileEdited(OWN_FILE, '"Written here"', '"Edited here"', async () => {
      await expect(frameOf(page).getByText("Edited here")).toBeVisible();
      await expect(field).toHaveValue("typed before the edit");
      await expect(page.locator(".forgebook-code-block")).toContainText('label="Edited here"');
    });
  });

  test("draws an edit of the file its story is re-exported from, and keeps the text typed in it", async ({
    page
  }) => {
    await page.goto(story("behind"));
    const field = frameOf(page).getByLabel("Note");
    await field.fill("typed before the edit");
    await whileEdited(BEHIND_FILE, '"Written behind a re-export"', '"Edited behind"', async () => {
      await expect(frameOf(page).getByText("Edited behind")).toBeVisible();
      await expect(field).toHaveValue("typed before the edit");
    });
  });
});
