/**
 * The answers of `forgebook stories` and `forgebook story` as text for a terminal: a table of the stories, one story's
 * facts, and the problems. Pure: documents in, text out, laid out with cli-kit's helpers.
 *
 * @remarks
 * Nothing is cut to the terminal's width: ids and links are what a reader copies, so a long line wraps instead.
 *
 * @module
 */
import { keyValue, table } from "@ensiria/cli-kit/layout";
import type { OutputStyle } from "@ensiria/cli-kit/log.types";

import type { StoriesDocument, StoryDocument } from "../../src/vite/agent.types.ts";

/** The style with no width to fit, so no cell is cut. */
const uncut = (style: OutputStyle): OutputStyle => ({ ...style, width: Number.POSITIVE_INFINITY });

/**
 * The stories as a table: one row per story, its id first (what `forgebook story` takes, never cut), then its
 * component's title and its name.
 *
 * @param document - the stories document.
 * @param style - colours, glyphs and width.
 */
export const storiesText = (document: StoriesDocument, style: OutputStyle): string =>
  table(
    document.components.flatMap((component) =>
      component.stories.map((story) => [
        story.id,
        `${component.title} › ${story.name}${story.isUnlisted ? " (unlisted)" : ""}`
      ])
    ),
    { columns: [{ header: "Id" }, { header: "Story", tone: "muted" }] },
    uncut(style)
  );

/**
 * One story's facts: where it is, where it opens, its args and its component's props.
 *
 * @param document - the story document.
 * @param style - colours, glyphs and width.
 */
export const storyText = (document: StoryDocument, style: OutputStyle): string => {
  const entries: (readonly [string, string])[] = [
    ["Story", `${document.component.title} › ${document.story.name}`],
    ["Id", document.story.id],
    ["File", document.component.file],
    ["Opens at", document.story.links.address],
    ["Frame", document.story.links.frame],
    ["Args", JSON.stringify(document.args)],
    ["Props", document.docs === undefined ? "none" : document.docs.props.map((prop) => prop.name).join(", ")]
  ];
  if (document.story.description !== undefined) entries.push(["About", document.story.description]);
  return keyValue(entries, uncut(style));
};
