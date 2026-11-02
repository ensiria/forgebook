/**
 * A docs page read from its Markdown: its front matter, what the index lists without rendering it, and, when it opens,
 * its blocks.
 *
 * @remarks
 * Markdown with fenced blocks instead of MDX: a page is read here at build time, with no compiler in the page. The top-level code fences become blocks of their own (a fence named `story <id>` draws a frame, one
 * named `props <id>` an API table, any other is code with a copy button), and what lies between them is HTML. A block
 * sits in the page's own flow, so a fence inside a list or a quote stays code and is reported. A page's files are the
 * package's, read at build time, and Markdown lets them hold raw HTML, so a page is trusted as a story's code is: whoever
 * can write one can run script in the catalogue.
 *
 * Reading the index never renders, so a catalogue with many pages pays for highlighting only on the pages opened.
 *
 * @module
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import type { DocPageIndex } from "@forgebook/story-format/source";
import { Marked, type Token, type Tokens } from "marked";

import {
  ASSET_SCHEME,
  type DocBlock,
  type DocHeading,
  type DocPage,
  PAGE_LINK_SCHEME,
  pageSlug
} from "../docPages.ts";
import { storyName } from "../storyTree.ts";
import { codeHtml } from "./componentPage.ts";
import { escapeHtml, highlightCode } from "./highlightCode.ts";

/** Reads a linked page's text: none when it is not there. */
export type ReadPage = (file: string) => string | undefined;

/**
 * A linked page's text from the disk.
 *
 * @param file - the file.
 */
export const readLinkedFile: ReadPage = (file: string): string | undefined => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
};

/** The line a front matter starts and ends with. */
const FENCE = "---";

/** The keys a front matter can hold. */
const FRONT_MATTER_KEYS = ["title", "order", "description"];

/** A page's front matter and the Markdown after it. */
type FrontMatter = {
  /** The Markdown after the front matter. */
  readonly body: string;
  /** Its `title`, when it has one. */
  readonly title: string | undefined;
  /** Its `order`, when it has a number. */
  readonly order: number | undefined;
  /** Its `description`, when it has one. */
  readonly description: string | undefined;
  /** What in it cannot be used. */
  readonly notes: readonly string[];
};

/** A value without its surrounding quotes. */
const unquoted = (value: string): string => {
  const first = value.at(0);
  return value.length > 1 && (first === '"' || first === "'") && value.endsWith(first)
    ? value.slice(1, -1)
    : value;
};

/**
 * The fields of a front matter's lines.
 *
 * @param lines - the lines between its fences.
 * @param notes - receives the lines it cannot read.
 */
const frontMatterFields = (lines: readonly string[], notes: string[]): ReadonlyMap<string, string> => {
  const fields = new Map<string, string>();
  for (const line of lines) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const colon = line.indexOf(":");
    const key = line.slice(0, colon).trim();
    if (colon === -1 || !FRONT_MATTER_KEYS.includes(key)) {
      notes.push(`its front matter has a line it does not read: "${line.trim()}"`);
      continue;
    }
    fields.set(key, unquoted(line.slice(colon + 1).trim()));
  }
  return fields;
};

/**
 * A page's text split at its front matter: `key: value` lines between two `---` lines, the file's very first line
 * the opening one.
 *
 * @remarks
 * Only three plain keys, so no YAML parser joins the core's dependencies; a key it does not know is reported, since a
 * typo would otherwise leave a page silently out of its place.
 *
 * @param text - the file's text.
 */
export const frontMatterOf = (text: string): FrontMatter => {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const none = { title: undefined, order: undefined, description: undefined };
  if (lines[0]?.trim() !== FENCE) return { ...none, body: lines.join("\n"), notes: [] };
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === FENCE);
  if (end === -1) return { ...none, body: lines.join("\n"), notes: ["its front matter never ends"] };
  const notes: string[] = [];
  const fields = frontMatterFields(lines.slice(1, end), notes);
  const orderText = fields.get("order");
  const order = orderText === undefined || orderText === "" ? undefined : Number(orderText);
  if (order !== undefined && !Number.isFinite(order)) notes.push(`its order "${orderText}" is not a number`);
  return {
    body: lines.slice(end + 1).join("\n"),
    title: fields.get("title") || undefined,
    order: order !== undefined && Number.isFinite(order) ? order : undefined,
    description: fields.get("description") || undefined,
    notes
  };
};

/** A parser for reading a page's tokens: nothing rendered. */
const LEXER = new Marked({ async: false, gfm: true });

/** What a code block's fence says after its backticks; empty for any other token. */
const fenceText = (token: Token): string =>
  token.type === "code" && typeof token["lang"] === "string" ? token["lang"].trim() : "";

/** A link's or an image's address; none for any other token. */
const hrefOf = (token: Token): string | undefined =>
  (token.type === "link" || token.type === "image") && typeof token["href"] === "string"
    ? token["href"]
    : undefined;

/** A fenced block's kind and what it names, when the fence is one of the page's own blocks. */
const fenceOf = (token: Token): { readonly kind: "story" | "props"; readonly id: string } | undefined => {
  const [kind, id = ""] = fenceText(token).split(/\s+/);
  return (kind === "story" || kind === "props") && id !== "" ? { kind, id } : undefined;
};

/** Whether a fence names a kind of block but no id: it would otherwise show as code, without a word. */
const isIdlessFence = (token: Token): boolean => /^(story|props)$/.test(fenceText(token));

/** The first token that is not blank space. */
const firstToken = (tokens: readonly Token[]): Token | undefined =>
  tokens.find((token) => token.type !== "space");

/** The tokens without the page's opening `#` title: the page's header shows the title. */
const withoutTitle = (tokens: readonly Token[]): readonly Token[] => {
  const first = firstToken(tokens);
  return first?.type === "heading" && first["depth"] === 1
    ? tokens.filter((token) => token !== first)
    : tokens;
};

/** A file name as a page's title: `getting-started.md` → "Getting started". */
const titleFromFile = (file: string): string => storyName(basename(file, ".md").replace(/[-_]+/g, " "));

/**
 * A page's title: its front matter's, else its opening `#` heading, else its file's name.
 *
 * @param file - the page's file.
 * @param frontMatter - its front matter.
 */
const titleOf = (file: string, frontMatter: FrontMatter): string => {
  if (frontMatter.title !== undefined) return frontMatter.title;
  const first = firstToken(LEXER.lexer(frontMatter.body));
  return first?.type === "heading" && first["depth"] === 1 && typeof first["text"] === "string"
    ? first["text"]
    : titleFromFile(file);
};

/** Whether an address is outside the page's folder: it has a scheme, or starts at the root or the page's own address. */
const isOutside = (href: string): boolean => /^([a-z][a-z0-9+.-]*:|\/|#|\?)/i.test(href);

/** A path as a link writes it, its escapes read: a `%` that escapes nothing is a file's own character. */
const decodedPath = (path: string): string => {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
};

/** The file an address relative to a page names, and its fragment. */
const relativeTarget = (
  file: string,
  href: string
): { readonly file: string; readonly fragment: string | undefined } => {
  const [path = "", fragment] = href.split("#");
  return { file: resolve(dirname(file), decodedPath(path)), fragment };
};

/**
 * The folder of the package a file belongs to: the nearest with a `package.json`, or the file's own without one.
 *
 * @param file - the file.
 */
const packageFolderOf = (file: string): string => {
  let folder = dirname(file);
  while (!existsSync(join(folder, "package.json"))) {
    const parent = dirname(folder);
    if (parent === folder) return dirname(file);
    folder = parent;
  }
  return folder;
};

/**
 * Whether a page may show a file as an image: a file of its own package. A build copies an image into the catalogue
 * whatever it is, so a path that climbs out of the package would publish a file a reviewer took for a picture's name.
 *
 * @param file - the page's file.
 * @param image - the image's file.
 */
const isOwnImage = (file: string, image: string): boolean => {
  const fromPackage = relative(packageFolderOf(file), image);
  return !fromPackage.startsWith("..") && existsSync(image) && statSync(image).isFile();
};

/** Whether a link names another page by its file. */
const isPageLink = (href: string): boolean => !isOutside(href) && /\.md(#|$)/i.test(href);

/** The slug of the page a link names; none when its file is not there. */
const linkedSlug = (file: string, href: string, read: ReadPage): string | undefined => {
  const target = relativeTarget(file, href);
  const text = read(target.file);
  return text === undefined ? undefined : pageSlug(titleOf(target.file, frontMatterOf(text)));
};

/**
 * What a page's token gets wrong.
 *
 * @param token - the token.
 * @param isBlock - whether it is a top-level block of the page.
 * @param file - the page's file.
 * @param read - reads a linked page's text.
 */
const tokenNotes = (token: Token, isBlock: boolean, file: string, read: ReadPage): string[] => {
  if (isIdlessFence(token)) return [`a \`${fenceText(token)}\` block names no id`];
  if (fenceOf(token) !== undefined && !isBlock)
    return [`a \`${fenceText(token)}\` block inside a list or a quote is not drawn`];
  const href = hrefOf(token);
  if (href === undefined || isOutside(href)) return [];
  if (token.type === "image" && !isOwnImage(file, relativeTarget(file, href).file))
    return [`its image "${href}" is not a file of its package`];
  return token.type === "link" && isPageLink(href) && linkedSlug(file, href, read) === undefined
    ? [`it links to "${href}", which is not there`]
    : [];
};

/**
 * What the index lists of a page, read from its text without rendering it.
 *
 * @param file - the page's file, absolute.
 * @param text - its text.
 * @param read - reads a linked page's text; from the disk by default.
 */
export const docPageIndex = (file: string, text: string, read: ReadPage = readLinkedFile): DocPageIndex => {
  const frontMatter = frontMatterOf(text);
  const { order, description } = frontMatter;
  const tokens = LEXER.lexer(frontMatter.body);
  const stories: string[] = [];
  const components: string[] = [];
  const links: string[] = [];
  const notes = [...frontMatter.notes];
  for (const token of tokens) {
    const fence = fenceOf(token);
    if (fence?.kind === "story") stories.push(fence.id);
    if (fence?.kind === "props") components.push(fence.id);
  }
  const blocks = new Set<Token>(tokens);
  void LEXER.walkTokens(tokens, (token: Token): void => {
    notes.push(...tokenNotes(token, blocks.has(token), file, read));
    const href = hrefOf(token);
    const slug =
      token.type === "link" && href !== undefined && isPageLink(href)
        ? linkedSlug(file, href, read)
        : undefined;
    if (slug !== undefined) links.push(slug);
  });
  return {
    title: titleOf(file, frontMatter),
    ...(order === undefined ? {} : { order }),
    ...(description === undefined ? {} : { description }),
    stories,
    components,
    links,
    ...(notes.length === 0 ? {} : { notes })
  };
};

/**
 * What inline tokens say, without marks or raw HTML.
 *
 * @param tokens - the tokens.
 */
const plainText = (tokens: readonly Token[]): string =>
  tokens
    .map((token): string => {
      if (token.type === "html") return "";
      const nested: unknown = "tokens" in token ? token.tokens : undefined;
      if (Array.isArray(nested) && nested.length > 0) return plainText(nested);
      return "text" in token && typeof token.text === "string" ? token.text : "";
    })
    .join("");

/**
 * The Markdown renderer of one page: it keeps the page's headings, so it is made for each page.
 *
 * @remarks
 * A heading links to itself rather than holding a separate "link to this section" control: the heading's own words
 * name the link for a screen reader, so the HTML, made at build time, holds no text of the shell's. Anchors are made
 * as GitHub makes them (`tokens`, `tokens-1`), so a link written for a repository's reader keeps working here.
 *
 * @param headings - receives the page's second- and third-level headings.
 */
const pageRenderer = (headings: DocHeading[]): Marked => {
  const seen = new Set<string>();
  const anchorOf = (text: string): string => {
    const slug =
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "") || "section";
    let anchor = slug;
    // "Tokens", "Tokens", "Tokens 1": counting alone would give the last two the same anchor
    for (let count = 1; seen.has(anchor); count += 1) anchor = `${slug}-${count}`;
    seen.add(anchor);
    return anchor;
  };
  return new Marked({
    async: false,
    gfm: true,
    renderer: {
      code: codeHtml,
      heading({ tokens, depth }: Tokens.Heading): string {
        const text = plainText(tokens);
        const anchor = anchorOf(text);
        if (depth === 2 || depth === 3) headings.push({ depth, anchor, text });
        // a link cannot hold a link, so a heading with one in it keeps its words and loses their marks
        const hasLink = tokens.some((token) => token.type === "link");
        const words = hasLink ? escapeHtml(text) : this.parser.parseInline(tokens);
        return `<h${depth} id="doc-${escapeHtml(anchor)}"><a class="forgebook-anchor" href="#${escapeHtml(anchor)}">${words}</a></h${depth}>\n`;
      },
      link({ href, title, tokens }: Tokens.Link): string {
        const titled = title === null || title === undefined ? "" : ` title="${escapeHtml(title)}"`;
        // a page of the catalogue opens in place; another site must not replace the catalogue being read
        const opens = /^https?:/i.test(href) ? ' target="_blank" rel="noreferrer"' : "";
        return `<a href="${escapeHtml(href)}"${titled}${opens}>${this.parser.parseInline(tokens)}</a>`;
      }
    }
  });
};

/** The address the shell fills for a link to another page, by its slug; none when the file is not there. */
const pageAddress = (file: string, href: string, read: ReadPage): string | undefined => {
  const slug = linkedSlug(file, href, read);
  if (slug === undefined) return undefined;
  const { fragment } = relativeTarget(file, href);
  return `${PAGE_LINK_SCHEME}${slug}${fragment === undefined ? "" : `#${fragment}`}`;
};

/**
 * Writes a page's links and images for the shell: a link to another page by its slug, an image by its place in the
 * list of files returned.
 *
 * @param file - the page's file, absolute.
 * @param tokens - the page's tokens, changed in place.
 * @param read - reads a linked page's text.
 * @returns the image files, in the order their addresses name them.
 */
const addressTokens = (file: string, tokens: readonly Token[], read: ReadPage): string[] => {
  const images: string[] = [];
  void LEXER.walkTokens([...tokens], (token: Token): void => {
    const href = hrefOf(token);
    if (href === undefined) return;
    if (token.type === "link" && isPageLink(href)) token.href = pageAddress(file, href, read) ?? href;
    if (token.type !== "image" || isOutside(href)) return;
    const image = relativeTarget(file, href).file;
    if (!isOwnImage(file, image)) return;
    images.push(image);
    token.href = `${ASSET_SCHEME}${images.length - 1}`;
  });
  return images;
};

/**
 * The tokens as blocks: each top-level fence on its own, the text between them as HTML.
 *
 * @param tokens - the page's tokens.
 * @param renderer - the page's renderer.
 */
const blocksOf = (tokens: readonly Token[], renderer: Marked): DocBlock[] => {
  const blocks: DocBlock[] = [];
  let text: Token[] = [];
  const flushText = (): void => {
    if (text.length === 0) return;
    blocks.push({ kind: "text", html: renderer.parser(text) });
    text = [];
  };
  for (const token of tokens) {
    if (token.type === "space") continue;
    if (token.type !== "code") {
      text.push(token);
      continue;
    }
    flushText();
    const fence = fenceOf(token);
    if (fence === undefined) {
      const code = String(token["text"]);
      const language = typeof token["lang"] === "string" ? token["lang"].trim().split(/\s+/)[0] : undefined;
      blocks.push({
        kind: "code",
        text: code,
        html: highlightCode(code, language || undefined),
        ...(language ? { language } : {})
      });
    } else blocks.push(fence);
  }
  flushText();
  return blocks;
};

/** A docs page as its module gives it: what the shell draws, with its images as files, and its Markdown. */
export type CompiledDocPage = Omit<DocPage, "assets"> & {
  /** The image files, absolute: the module imports each, and its address takes the file's place. */
  readonly images: readonly string[];
  /** The page's Markdown, without its front matter, for tools. */
  readonly text: string;
};

/**
 * A page, rendered: its blocks, its headings and its images.
 *
 * @param file - the page's file, absolute.
 * @param text - its text.
 * @param read - reads a linked page's text; from the disk by default.
 */
export const compiledDocPage = (
  file: string,
  text: string,
  read: ReadPage = readLinkedFile
): CompiledDocPage => {
  const { body } = frontMatterOf(text);
  const headings: DocHeading[] = [];
  const renderer = pageRenderer(headings);
  const tokens = withoutTitle(renderer.lexer(body));
  const images = addressTokens(file, tokens, read);
  return { blocks: blocksOf(tokens, renderer), headings, images, text: body.trim() };
};
