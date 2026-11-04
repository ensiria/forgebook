/**
 * A docs page, or the catalogue's written home, read from its Markdown: what the index lists without rendering it,
 * and, when it opens, its blocks.
 *
 * @remarks
 * Markdown with directives instead of MDX: a page is read here at build time, with no compiler in the page. Its body
 * is split into blocks by line (`docDirectives.ts`), each given its meaning and checked (`docPageBlocks.ts`), and turned
 * into HTML (`docPageRender.ts`). A page's files are the package's, read at build time, and Markdown lets them hold raw
 * HTML, so a page is trusted as a story's code is: whoever can write one can run script in the catalogue.
 *
 * Reading the index never renders, so a catalogue with many pages pays for highlighting only on the pages opened.
 *
 * @module
 */
import type { DocPageIndex } from "@forgebook/story-format/source";

import type { DocPage } from "../docPages.ts";
import { bodySegments, noteText, type PageNote, sourceLines } from "./docDirectives.ts";
import { type FrontMatter, frontMatterOf, LEXER, openingHeading, titleOf } from "./docMarkdown.ts";
import { type PageNode, pageNodes } from "./docPageBlocks.ts";
import { packageVersionOf, type ReadPage, readLinkedFile } from "./docPageLinks.ts";
import { renderedPage } from "./docPageRender.ts";
import type { PageReading } from "./docPageTokens.ts";

/** A page read: its front matter, its nodes and what reading gathered. */
type ReadDocPage = {
  readonly frontMatter: FrontMatter;
  readonly nodes: readonly PageNode[];
  readonly reading: PageReading;
};

/** Notes in the order of the file, those about the whole page first. */
const inFileOrder = (notes: readonly PageNote[]): PageNote[] =>
  [...notes].sort(
    (left, right) =>
      (left.position?.line ?? 0) - (right.position?.line ?? 0) ||
      (left.position?.column ?? 0) - (right.position?.column ?? 0)
  );

/** The nodes without the page's opening `#` title, which the page's header shows. */
const withoutTitle = (nodes: readonly PageNode[]): readonly PageNode[] => {
  const first = nodes[0];
  if (first?.type !== "tokens" || openingHeading(first.tokens) === undefined) return nodes;
  const heading = first.tokens.find((token) => token.type !== "space");
  return [{ type: "tokens", tokens: first.tokens.filter((token) => token !== heading) }, ...nodes.slice(1)];
};

/**
 * A page read, every block checked.
 *
 * @param file - the page's file, absolute.
 * @param text - its text.
 * @param read - reads a linked page's text.
 * @param isHome - whether it is the catalogue's written home.
 * @param pluginFences - the fences the catalogue's plugins draw.
 */
const readDocPage = (
  file: string,
  text: string,
  read: ReadPage,
  isHome: boolean,
  pluginFences: readonly string[]
): ReadDocPage => {
  const frontMatter = frontMatterOf(text);
  let version: { readonly value: string | undefined } | undefined;
  const reading: PageReading = {
    file,
    read,
    isHome,
    pluginFences,
    version: (): string | undefined => {
      version ??= { value: packageVersionOf(file) };
      return version.value;
    },
    notes: frontMatter.notes.map((note) => ({
      position: { line: note.line, column: 1 },
      message: note.message
    })),
    fences: new Map(),
    stories: [],
    components: [],
    links: [],
    sources: [],
    images: []
  };
  const segments = bodySegments(sourceLines(frontMatter.body, frontMatter.bodyLine), reading.notes);
  const nodes = withoutTitle(pageNodes(segments, reading));
  return { frontMatter, nodes, reading };
};

/** A page's notes as the index lists them, in the order of the file. */
const notesOf = (reading: PageReading): string[] => inFileOrder(reading.notes).map(noteText);

/**
 * What the index lists of a page, read from its text without rendering it.
 *
 * @param file - the page's file, absolute.
 * @param text - its text.
 * @param read - reads a linked page's text; from the disk by default.
 * @param fences - the fences the catalogue's plugins draw; none by default.
 */
export const docPageIndex = (
  file: string,
  text: string,
  read: ReadPage = readLinkedFile,
  fences: readonly string[] = []
): DocPageIndex => {
  const { frontMatter, reading } = readDocPage(file, text, read, false, fences);
  const { order, description } = frontMatter;
  const notes = notesOf(reading);
  return {
    title: titleOf(file, frontMatter),
    ...(order === undefined ? {} : { order }),
    ...(description === undefined ? {} : { description }),
    stories: reading.stories,
    components: reading.components,
    links: reading.links,
    ...(notes.length === 0 ? {} : { notes })
  };
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
 * @param fences - the fences the catalogue's plugins draw; none by default.
 */
export const compiledDocPage = (
  file: string,
  text: string,
  read: ReadPage = readLinkedFile,
  fences: readonly string[] = []
): CompiledDocPage => {
  const { frontMatter, nodes, reading } = readDocPage(file, text, read, false, fences);
  const { blocks, headings } = renderedPage(nodes, reading.fences);
  return { blocks, headings, images: reading.images, text: frontMatter.body.trim() };
};

/** What the catalogue's written home lists without rendering it. */
export type HomeIndex = {
  /** Its title: its front matter's or its opening heading's; none to show the catalogue's. */
  readonly title: string | undefined;
  /** Its lead, the front matter's `description`; none when it has none. */
  readonly description: string | undefined;
  /** The stories it shows. */
  readonly stories: readonly string[];
  /** The components whose tables it shows. */
  readonly components: readonly string[];
  /** The sources its pieces name, to check against the catalogue's. */
  readonly sources: readonly string[];
  /** What it gets wrong, each with its line and column. */
  readonly notes: readonly string[];
};

/** A front matter's text with `{{version}}` written in: the shell fills the other values, as in the text. */
const withVersion = (text: string | undefined, reading: PageReading): string | undefined =>
  text?.replace(/\{\{\s*version\s*\}\}/g, () => reading.version() ?? "");

/** The home's title: its front matter's, else its opening heading; none for the catalogue's own. */
const homeTitle = (frontMatter: FrontMatter, reading: PageReading): string | undefined =>
  withVersion(frontMatter.title ?? openingHeading(LEXER.lexer(frontMatter.body)), reading);

/**
 * What the catalogue's written home lists, read without rendering it.
 *
 * @param file - the home's file, absolute.
 * @param text - its text.
 * @param read - reads a linked page's text; from the disk by default.
 * @param fences - the fences the catalogue's plugins draw; none by default.
 */
export const homeIndex = (
  file: string,
  text: string,
  read: ReadPage = readLinkedFile,
  fences: readonly string[] = []
): HomeIndex => {
  const { frontMatter, reading } = readDocPage(file, text, read, true, fences);
  return {
    title: homeTitle(frontMatter, reading),
    description: withVersion(frontMatter.description, reading),
    stories: reading.stories,
    components: reading.components,
    sources: reading.sources,
    notes: notesOf(reading)
  };
};

/** The written home as its module gives it. */
export type CompiledHome = Omit<CompiledDocPage, "headings"> & {
  /** Its title; none for the catalogue's. */
  readonly title: string | undefined;
  /** Its lead; none when it has none. */
  readonly description: string | undefined;
  /** The stories it shows, for their frames. */
  readonly stories: readonly string[];
  /** What it gets wrong, each with its line and column. */
  readonly notes: readonly string[];
};

/**
 * The catalogue's written home, rendered.
 *
 * @param file - the home's file, absolute.
 * @param text - its text.
 * @param read - reads a linked page's text; from the disk by default.
 * @param fences - the fences the catalogue's plugins draw; none by default.
 */
export const compiledHome = (
  file: string,
  text: string,
  read: ReadPage = readLinkedFile,
  fences: readonly string[] = []
): CompiledHome => {
  const { frontMatter, nodes, reading } = readDocPage(file, text, read, true, fences);
  const { blocks } = renderedPage(nodes, reading.fences);
  return {
    title: homeTitle(frontMatter, reading),
    description: withVersion(frontMatter.description, reading),
    blocks,
    images: reading.images,
    stories: reading.stories,
    notes: notesOf(reading),
    text: frontMatter.body.trim()
  };
};
