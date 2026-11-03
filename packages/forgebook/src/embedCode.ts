/**
 * The link a person pastes in a wiki and the HTML they paste in a page of their own to show a story: an iframe, and on
 * request the few lines that keep it as tall as the story. Pure, and loaded only when the Embed panel opens.
 *
 * @remarks
 * The link carries only what draws the story: compare, the matrix, the zoom and the panel are the stage's. The iframe
 * alone is the default: a wiki keeps it and removes scripts, and it then simply stays at the height written in it. The
 * script answers only its own iframe's window and only that window's origin, and sets nothing but a height.
 *
 * @module
 */
import { EMBED_PARAMETER, EMBED_SIZE_TYPE } from "./embed.ts";

/** The parameters an embed does not read: they belong to the stage, so a link keeps none of them. */
const STAGE_PARAMETERS: readonly string[] = [
  EMBED_PARAMETER,
  "component",
  "story",
  "compare",
  "audience",
  "matrix",
  "panel",
  "tab",
  "zoom",
  "tools"
];

/** What the code is made from. */
export type EmbedCodeInput = {
  /** The story's address, shown alone. */
  readonly link: string;
  /** The iframe's accessible title. */
  readonly title: string;
  /** Its height until a script sets another, in CSS px. */
  readonly height: number;
  /** Whether the iframe follows the story's height, with a script. */
  readonly isFollowing: boolean;
};

/** What ends or opens something in an HTML attribute, with what stands for it. */
const ATTRIBUTE_ENTITIES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;"
};

/**
 * Text set in an HTML attribute: what could end it escaped.
 *
 * @param text - the text.
 */
const attribute = (text: string): string =>
  text.replace(/[&<>"]/g, (character) => ATTRIBUTE_ENTITIES[character] ?? character);

/**
 * The script that keeps the iframe before it as tall as its story.
 *
 * @param link - the story's address, whose origin is the only one answered.
 */
const followScript = (link: string): string => {
  // a link holds no `<` once read as a URL, but a script's text must never be able to close its element
  const origin = JSON.stringify(new URL(link).origin).replace(/</g, "\\u003c");
  return [
    "<script>",
    "(() => {",
    "  const frame = document.currentScript.previousElementSibling;",
    '  addEventListener("message", ({ source, origin, data }) => {',
    `    if (source !== frame.contentWindow || origin !== ${origin}) return;`,
    `    if (data?.type === ${JSON.stringify(EMBED_SIZE_TYPE)} && Number.isFinite(data.height)) frame.height = data.height;`,
    "  });",
    "})();",
    "</script>"
  ].join("\n");
};

/**
 * The HTML that shows a story.
 *
 * @param input - the story's address, the iframe's title and height, and whether it follows the story.
 */
export const embedCode = ({ link, title, height, isFollowing }: EmbedCodeInput): string => {
  const frame = `<iframe src="${attribute(link)}" title="${attribute(title)}" width="100%" height="${Math.round(height)}" loading="lazy" style="border: 0"></iframe>`;
  return isFollowing ? `${frame}\n${followScript(link)}` : frame;
};

/**
 * The address of a story shown alone, the view kept as written.
 *
 * @param pageUrl - the catalogue's page (`https://ui.example.com/`).
 * @param id - the story's id.
 * @param search - the view's query (`theme=dark&lang=it`), with or without `?`.
 */
export const embedAddressOf = (pageUrl: string, id: string, search: string): string => {
  const params = new URLSearchParams(search);
  for (const name of STAGE_PARAMETERS) params.delete(name);
  params.set("story", id);
  return `${pageUrl}?${EMBED_PARAMETER}&${params.toString()}`;
};

/**
 * Whether an address opens only on the computer it was copied on: a link from a dev server, which a wiki cannot reach.
 *
 * @param link - the address.
 */
export const isLocalAddress = (link: string): boolean =>
  ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"].includes(new URL(link).hostname);
