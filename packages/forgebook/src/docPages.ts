/**
 * What the plugin and the shell share about a docs page: the links its HTML leaves for the shell to fill, and the shape
 * of what the plugin answers.
 *
 * @remarks
 * A page is compiled without knowing its source's id or the reader's view, and an image's address is known only once
 * Vite answers its import, so the HTML names them with a scheme of its own and the shell writes the real addresses in.
 * Headings carry a prefixed element id, so a heading called "Root" never takes the id the shell mounts in; the
 * address's fragment stays the plain anchor (`#root`) a person would write by hand. A page's blocks are a protocol
 * between the plugin and the shell of one version, so their types live here, not in the public story format. Pure.
 *
 * @module
 */
import { anchorOf } from "./pageAddress.ts";

/** One piece of a docs page, in the order of its file. */
export type DocBlock =
  | {
      /** Text between the other blocks. */
      readonly kind: "text";
      /** The text as HTML, its headings carrying their anchors. */
      readonly html: string;
    }
  | {
      /** A code block of the file, with a button that copies it. */
      readonly kind: "code";
      /** The code, as copied. */
      readonly text: string;
      /** The same code as HTML, coloured by the catalogue's plugin at build time. */
      readonly html: string;
      /** Its language as the fence names it (`tsx`), when it names one. */
      readonly language?: string;
    }
  | {
      /** A story, live in its frame: a fence named `story <id>`. */
      readonly kind: "story";
      /** The story's id, as the catalogue's address writes it (`kit:inputs-select--overview`). */
      readonly id: string;
    }
  | {
      /** A component's API table, drawn from its types: a fence named `props <id>`. */
      readonly kind: "props";
      /** The component's id, as the catalogue's address writes it (`kit:inputs-select`). */
      readonly id: string;
    }
  | {
      /** A plugin's block: a fence named as one of the plugin's. */
      readonly kind: "plugin";
      /** The fence's name. */
      readonly fence: string;
      /** What the fence's line says after its name. */
      readonly argument: string;
      /** The text inside the fence. */
      readonly body: string;
    };

/** A heading of a docs page, as its contents list names it. */
export type DocHeading = {
  /** Its level: 2 or 3. */
  readonly depth: 2 | 3;
  /** Its anchor, the fragment of the page's address (`tokens`): unique in the page. */
  readonly anchor: string;
  /** Its text, without marks. */
  readonly text: string;
};

/** A docs page as the catalogue's plugin answers it: what the shell draws. */
export type DocPage = {
  /** Its blocks, in the order of the file. */
  readonly blocks: readonly DocBlock[];
  /** Its second- and third-level headings, in the order of the file. */
  readonly headings: readonly DocHeading[];
  /** The addresses of the images it holds, which its HTML names by their place in this list. */
  readonly assets: readonly string[];
};

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

/** What every prop's anchor starts with: a heading's anchor never holds a dot, so the two cannot meet. */
const PROP_ANCHOR = "prop.";

/**
 * A prop's anchor, the fragment of its component page's address.
 *
 * @param name - the prop's name.
 * @param part - the part it belongs to; none for the component's own.
 */
export const propAnchor = (name: string, part?: string): string =>
  `${PROP_ANCHOR}${part === undefined ? "" : `${part}.`}${name}`;

/**
 * Where an anchor points in a page: a prop's row, which says its name in `data-prop` (`part.name` for a part's), or a
 * heading, by its element id.
 *
 * @param anchor - the anchor.
 */
export const anchorSelector = (anchor: string): string =>
  anchor.startsWith(PROP_ANCHOR)
    ? `[data-prop="${CSS.escape(anchor.slice(PROP_ANCHOR.length))}"]`
    : `[id="${CSS.escape(headingElementId(anchor))}"]`;

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a value is a block of a page. */
const isBlock = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  if (value["kind"] === "text") return typeof value["html"] === "string";
  if (value["kind"] === "code") return typeof value["text"] === "string" && typeof value["html"] === "string";
  if (value["kind"] === "plugin") {
    return (
      typeof value["fence"] === "string" &&
      typeof value["argument"] === "string" &&
      typeof value["body"] === "string"
    );
  }
  return (value["kind"] === "story" || value["kind"] === "props") && typeof value["id"] === "string";
};

/** Whether a value is a heading of a page. */
const isHeading = (value: unknown): boolean =>
  isRecord(value) &&
  (value["depth"] === 2 || value["depth"] === 3) &&
  typeof value["anchor"] === "string" &&
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
