/**
 * Pictures of stories taken in a browser, as `forgebook shot` asks for them: each story opened in each view asked for
 * (or every variant the browser tests check), pictured at its own height (as the shell sizes its frame), written as a
 * PNG file.
 *
 * @remarks
 * Loaded from the project by the command only when it runs, as the check is. A story is pictured at its start (its
 * clock held, animations off), so the same story in the same view gives the same picture. A frame that never says it
 * is ready is pictured as it is, so the picture shows what is wrong. The file's name is the story's id and the view's,
 * so the pictures of several views sit side by side.
 *
 * @module
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { StoryShot, StoryShotReport, StoryShotRequest } from "forgebook/story-check";

import { eachStoryPage, openedStory, type StoryPage } from "./storyPages.ts";

/** A text with no hyphens at its ends; a loop, since a regular expression slows on a long run of them. */
const trimmedHyphens = (text: string): string => {
  let start = 0;
  let end = text.length;
  while (start < end && text[start] === "-") start += 1;
  while (end > start && text[end - 1] === "-") end -= 1;
  return text.slice(start, end);
};

/**
 * A picture's file name: the story's id and the view's name, each kept to letters, digits and hyphens.
 *
 * @param storyPage - the story and the view.
 */
export const shotName = (storyPage: Pick<StoryPage, "story" | "name">): string => {
  const safe = (text: string): string => trimmedHyphens(text.replace(/[^a-zA-Z0-9-]+/g, "-"));
  return `${safe(storyPage.story.id)}--${safe(storyPage.name) || "default"}.png`;
};

/**
 * Pictures the stories a request names, in its views, on one browser.
 *
 * @param request - the stories, the views, the catalogue's settings and the folder.
 * @returns one picture per story and view, in the request's order.
 */
export const shotStories = async (request: StoryShotRequest): Promise<StoryShotReport> => {
  mkdirSync(request.outDir, { recursive: true });
  const shots = await eachStoryPage(request, async (page, storyPage): Promise<StoryShot> => {
    const status = await openedStory(page, storyPage);
    const file = join(request.outDir, shotName(storyPage));
    // the story at its own height, not the window's: the body's, as the shell sizes a frame
    const size = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      height: Math.max(1, Math.ceil(document.body.getBoundingClientRect().height))
    }));
    await page.screenshot({
      path: file,
      fullPage: true,
      clip: { x: 0, y: 0, ...size },
      animations: "disabled"
    });
    return {
      storyId: storyPage.story.id,
      view: storyPage.name,
      frame: storyPage.frame,
      file,
      ...(status === "ready" ? {} : { status })
    };
  });
  return { schema: 1, shots };
};
