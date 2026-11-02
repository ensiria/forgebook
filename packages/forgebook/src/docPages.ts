/**
 * What the plugin and the shell share about a docs page: the links its HTML leaves for the shell to fill, and the shape
 * of what the plugin answers.
 *
 * @remarks
 * A page is compiled without knowing its source's id or the reader's view, and an image's address is known only once
 * Vite answers its import, so the HTML names them with a scheme of its own and the shell writes the real addresses in.
 * Headings carry a prefixed element id, so a heading called "Root" never takes the id the shell mounts in; the
 * address's fragment stays the plain anchor (`#root`) a person would write by hand. Pure.
 *
 * @module
 */
import type { DocPage } from "@forgebook/story-format/source";

/** What a link to another page of the source starts with in the compiled HTML: its slug and fragment follow. */
export const PAGE_LINK_SCHEME = "forgebook-page:";

/** What an image's address starts with in the compiled HTML: its place in the page's `assets` follows. */
export const ASSET_SCHEME = "forgebook-asset:";

/** What every heading's element id starts with. */
const HEADING_ID_PREFIX = "doc-";

/**
 * A heading's element id.
 *
 * @param anchor - its anchor, as the address's fragment writes it.
 */
export const headingElementId = (anchor: string): string => `${HEADING_ID_PREFIX}${anchor}`;

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a value is a block of a page. */
const isBlock = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  if (value["kind"] === "text") return typeof value["html"] === "string";
  if (value["kind"] === "code") return typeof value["text"] === "string" && typeof value["html"] === "string";
  return (value["kind"] === "story" || value["kind"] === "props") && typeof value["id"] === "string";
};

/** Whether a value is a heading of a page. */
const isHeading = (value: unknown): boolean =>
  isRecord(value) &&
  (value["depth"] === 2 || value["depth"] === 3) &&
  typeof value["id"] === "string" &&
  typeof value["text"] === "string";

/**
 * Whether a value is a docs page: what a page's loader gives is unchecked data.
 *
 * @param value - what the loader gave.
 */
export const isDocPage = (value: unknown): value is DocPage =>
  isRecord(value) &&
  Array.isArray(value["blocks"]) &&
  value["blocks"].every(isBlock) &&
  Array.isArray(value["headings"]) &&
  value["headings"].every(isHeading) &&
  Array.isArray(value["assets"]) &&
  value["assets"].every((asset) => typeof asset === "string");

/** A text set in an HTML attribute. */
const attributeText = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

/** What a link names, as the HTML escaped it: a fragment read back, or none when it is not valid. */
const anchorOf = (fragment: string | undefined): string | undefined => {
  if (fragment === undefined || fragment === "") return undefined;
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
};

/**
 * A page's HTML with the real addresses written in: its links to other pages, for the reader's view, and its images.
 *
 * @param html - the HTML of one of the page's blocks.
 * @param pageHref - a page's address, by its slug and anchor.
 * @param assets - the page's images' addresses.
 */
export const linkedHtml = (
  html: string,
  pageHref: (slug: string, anchor: string | undefined) => string,
  assets: readonly string[]
): string =>
  html
    .replace(
      new RegExp(`href="${PAGE_LINK_SCHEME}([^"#]*)(?:#([^"]*))?"`, "g"),
      (_link: string, slug: string, fragment: string | undefined) =>
        `href="${attributeText(pageHref(slug, anchorOf(fragment)))}"`
    )
    .replace(new RegExp(`src="${ASSET_SCHEME}(\\d+)"`, "g"), (_image: string, place: string) => {
      const asset = assets[Number(place)];
      return asset === undefined ? 'src=""' : `src="${attributeText(asset)}"`;
    });
