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

/** The tones of an aside, as its directive names them: `:::note`, `:::tip`, `:::important`, `:::caution`, `:::danger`. */
export const ASIDE_TONES = ["note", "tip", "important", "caution", "danger"] as const;

/** An aside's tone: what kind of remark it is, and its colour. */
export type AsideTone = (typeof ASIDE_TONES)[number];

/** The pieces of today's home a written home can place, as their leaf directive names them (`::families`). */
export const HOME_PIECES = ["recent", "libraries", "families", "pages"] as const;

/** A piece of the home drawn from the catalogue: the pages opened last, the libraries, their families, their pages. */
export type HomePiece = (typeof HOME_PIECES)[number];

/** The values a page's text can name in double braces (`{{components}}`). */
export const PAGE_VALUES = ["title", "version", "components", "stories", "libraries", "pages"] as const;

/** A value a page's text can name. */
export type PageValue = (typeof PAGE_VALUES)[number];

/** A link card: a page, a part of the catalogue or another site, with what it is about. */
export type LinkCard = {
  /** A card that links somewhere. */
  readonly kind: "link-card";
  /** What it links to, as the card names it. */
  readonly title: string;
  /** Its address: another page by its scheme, an address of the catalogue (`?component=…`), or another site. */
  readonly href: string;
  /** What is there, in a sentence; none when it does not say. */
  readonly description?: string;
};

/** One piece of a docs page, in the order of its file; a container holds blocks of its own. */
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
      /** The code, as copied: a diff's signs and its deleted lines left out. */
      readonly text: string;
      /** The same code as HTML, coloured by the catalogue's plugin at build time, its lines elements when marked. */
      readonly html: string;
      /** Its language as the fence names it (`tsx`), when it names one. */
      readonly language?: string;
      /** Its title, a file's name most often, when its fence gives one. */
      readonly title?: string;
      /** Whether its long lines wrap instead of scrolling. */
      readonly isWrapped?: boolean;
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
      /** A remark set apart: `:::note`, or a GitHub alert (`> [!NOTE]`). */
      readonly kind: "aside";
      /** What kind of remark it is. */
      readonly tone: AsideTone;
      /** Its own title; none shows its tone's name. */
      readonly title?: string;
      /** What it holds. */
      readonly children: readonly DocBlock[];
    }
  | {
      /** Panels of which one shows at a time: `::::tabs` around `:::tab[Label]` blocks. */
      readonly kind: "tabs";
      /** The name tabs share across pages: picking a tab picks the tab of the same label in each. */
      readonly sync?: string;
      /** The panels, each with its label. */
      readonly tabs: readonly { readonly label: string; readonly children: readonly DocBlock[] }[];
    }
  | {
      /** Numbered steps: `:::steps` around an ordered list, a step free to hold code or a story. */
      readonly kind: "steps";
      /** What each step holds. */
      readonly steps: readonly (readonly DocBlock[])[];
    }
  | {
      /** Cards side by side: `:::cards` around `:::card` and `::link-card` blocks. */
      readonly kind: "cards";
      /** The cards. */
      readonly children: readonly DocBlock[];
    }
  | {
      /** A card with a title and what it holds: `:::card[Title]`. */
      readonly kind: "card";
      /** Its title. */
      readonly title: string;
      /** What it holds. */
      readonly children: readonly DocBlock[];
    }
  | LinkCard
  | {
      /** A piece of the home drawn from the catalogue: `::recent`, `::libraries`, `::families`, `::pages`. */
      readonly kind: "home";
      /** Which piece. */
      readonly piece: HomePiece;
      /** Its own heading; none for the piece's own. */
      readonly label?: string;
      /** The source it shows alone, by id; none for every source. */
      readonly source?: string;
    }
  | {
      /** A block that could not be read, said in place: the index's problems name it too. */
      readonly kind: "problem";
      /** What is wrong, with its line and column. */
      readonly message: string;
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

/** The catalogue's written home as the plugin answers it: what the shell draws in place of the generated home. */
export type HomeDocument = {
  /** Its title; none shows the catalogue's. */
  readonly title?: string;
  /** Its lead, under the title; none when it has none. */
  readonly description?: string;
  /** Its blocks, in the order of the file. */
  readonly blocks: readonly DocBlock[];
  /** The stories it shows, for their frames. */
  readonly stories: readonly string[];
  /** What it gets wrong, each with its line and column, shown above it. */
  readonly notes: readonly string[];
  /** The addresses of the images it holds. */
  readonly assets: readonly string[];
};

/**
 * The id of the source of the project's own stories and docs pages: the pages the written home links to by their
 * file belong to it.
 */
export const OWN_SOURCE_ID = "stories";

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

/** Whether a value is a text, or absent. */
const isOptionalText = (value: unknown): boolean => value === undefined || typeof value === "string";

/** Whether a value is a list of blocks. */
const isBlocks = (value: unknown): boolean => Array.isArray(value) && value.every(isBlock);

/** Whether a value is a tab of a `tabs` block. */
const isTab = (value: unknown): boolean =>
  isRecord(value) && typeof value["label"] === "string" && isBlocks(value["children"]);

/** Whether a block of a known container kind holds what it should. */
const isContainer = (value: Readonly<Record<string, unknown>>): boolean => {
  switch (value["kind"]) {
    case "aside":
      return (
        ASIDE_TONES.some((tone) => tone === value["tone"]) &&
        isOptionalText(value["title"]) &&
        isBlocks(value["children"])
      );
    case "tabs":
      return isOptionalText(value["sync"]) && Array.isArray(value["tabs"]) && value["tabs"].every(isTab);
    case "steps":
      return Array.isArray(value["steps"]) && value["steps"].every(isBlocks);
    case "cards":
      return isBlocks(value["children"]);
    case "card":
      return typeof value["title"] === "string" && isBlocks(value["children"]);
    default:
      return false;
  }
};

/** Whether a value is a block of a page. */
const isBlock = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  switch (value["kind"]) {
    case "text":
      return typeof value["html"] === "string";
    case "code":
      return typeof value["text"] === "string" && typeof value["html"] === "string";
    case "story":
    case "props":
      return typeof value["id"] === "string";
    case "link-card":
      return typeof value["title"] === "string" && typeof value["href"] === "string";
    case "home":
      return HOME_PIECES.some((piece) => piece === value["piece"]) && isOptionalText(value["source"]);
    case "problem":
      return typeof value["message"] === "string";
    default:
      return isContainer(value);
  }
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
  isTexts(value["assets"]);

/** What a value the shell fills is written as in a page's HTML: its name follows, then `"></span>`. */
const VALUE_MARK = '<span data-forgebook-value="';

/**
 * A value the shell fills, as the compiled HTML writes it: an empty element the shell gives its text.
 *
 * @param name - the value's name.
 */
export const valueMark = (name: PageValue): string => `${VALUE_MARK}${name}"></span>`;

/** The values the shell knows when it draws a page; `version` is written in at build time. */
export type PageValues = Readonly<Record<Exclude<PageValue, "version">, string>>;

/**
 * A page's HTML with the values it names written in.
 *
 * @param html - the HTML of one of the page's blocks.
 * @param values - the values.
 */
export const filledHtml = (html: string, values: PageValues): string =>
  html.replace(/<span data-forgebook-value="([a-z]+)"><\/span>/g, (mark: string, name: string) => {
    const value = Object.entries(values).find(([key]) => key === name)?.[1];
    return value === undefined
      ? mark
      : value.replace(/[&<>"]/g, (character) => `&#${character.charCodeAt(0)};`);
  });

/**
 * A plain text of a page (a heading in the contents, a card's title) with the values it names written in.
 *
 * @param text - the text, naming a value as written (`{{components}}`).
 * @param values - the values.
 */
export const filledText = (text: string, values: PageValues): string =>
  text.replace(/\{\{\s*([a-z]+)\s*\}\}/g, (written: string, name: string) => {
    const value = Object.entries(values).find(([key]) => key === name)?.[1];
    return value ?? written;
  });

/** Whether a value is a list of texts. */
const isTexts = (value: unknown): boolean =>
  Array.isArray(value) && value.every((each) => typeof each === "string");

/**
 * Whether a value is the written home: what its loader gives is unchecked data.
 *
 * @param value - what the loader gave.
 */
export const isHomeDocument = (value: unknown): value is HomeDocument =>
  isRecord(value) &&
  isOptionalText(value["title"]) &&
  isOptionalText(value["description"]) &&
  isBlocks(value["blocks"]) &&
  isTexts(value["stories"]) &&
  isTexts(value["notes"]) &&
  isTexts(value["assets"]);

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

/**
 * A link card's address as the reader opens it: another page's scheme becomes that page's address in the reader's view.
 *
 * @param href - the card's address.
 * @param pageHref - a page's address, by its slug and anchor.
 */
export const linkedHref = (
  href: string,
  pageHref: (slug: string, anchor: string | undefined) => string
): string => {
  if (!href.startsWith(PAGE_LINK_SCHEME)) return href;
  const [slug = "", fragment] = href.slice(PAGE_LINK_SCHEME.length).split("#");
  return pageHref(slug, anchorOf(fragment));
};
