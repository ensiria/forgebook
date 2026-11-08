/**
 * What `check-markdown-blocks` reads in a Markdown file: its fenced blocks, and what is wrong with them. A fence nobody
 * closed turns the rest of the page into code, or the page's prose into a sample, and nothing else says so: GitHub and
 * npm render the mistake without a word. Pure: text in, problems out.
 *
 * @remarks
 * The fences follow CommonMark, with one rule stricter: a fence that opens with a language inside a block of the same
 * length or shorter is reported. To CommonMark it is the block's text, but it is what a lost closing fence looks like,
 * and a sample that shows fences has a longer fence around it. A sample that is itself Markdown is read the same way,
 * and a link to a heading of the page must find that heading outside every block, which is how prose swallowed by a
 * sample shows up when the fences around it happen to balance.
 *
 * @module
 */
import { parseAllDocuments } from "yaml";

/** One fenced block of a Markdown text. */
export type FencedBlock = {
  /** The language its opening fence names, lower case; empty when none. */
  readonly language: string;
  /** Its opening fence's line, from 1. */
  readonly line: number;
  /** Its lines, without the fences or the indentation the opening fence has. */
  readonly body: readonly string[];
  /** Whether a closing fence ends it, rather than the end of the text. */
  readonly isClosed: boolean;
  /** The lines that open a fence inside it, a sign of a lost closing fence. */
  readonly openersInside: readonly number[];
};

/** What the check found on one line of a text. */
export type BlockProblem = {
  /** The line, from 1. */
  readonly line: number;
  /** What is wrong. */
  readonly message: string;
};

/** The parts of a Markdown text the check reads. */
export type MarkdownParts = {
  /** Its fenced blocks, in order. */
  readonly blocks: readonly FencedBlock[];
  /** The lines outside every block, each with its number. */
  readonly prose: ReadonlyArray<{ readonly line: number; readonly text: string }>;
};

/** A fence: its indentation, its run of backticks or tildes, and what follows. */
const FENCE = /^( *)(`{3,}|~{3,})(.*)$/;

/** A line that opens a list item: its indentation and marker, whose width sets where the item's content starts. */
const LIST_ITEM = /^( *(?:[-*+]|\d{1,9}[.)]) +)\S/;

/** How far CommonMark lets a fence sit from its container's margin; further, it is text. */
const MAX_FENCE_INDENT = 3;

/** The languages whose blocks are parsed, and how. */
const YAML_LANGUAGES = new Set(["yaml", "yml"]);

/** The languages whose blocks are Markdown, read for fences of their own. */
const MARKDOWN_LANGUAGES = new Set(["md", "markdown"]);

/**
 * A line as a fence, when it can be one: a backtick fence's info text holds no backtick, so a line of inline code that
 * starts with three of them is prose.
 *
 * @param line - the line.
 */
const fenceOf = (line: string): { marker: string; indent: number; info: string } | undefined => {
  const match = FENCE.exec(line);
  if (match === null) return undefined;
  const [, indent = "", marker = "", info = ""] = match;
  if (marker.startsWith("`") && info.includes("`")) return undefined;
  return { marker, indent: indent.length, info: info.trim() };
};

/**
 * Whether a fence closes a block opened by another: the same character, at least as long, and nothing after it.
 *
 * @param fence - the fence read.
 * @param opener - the block's opening fence.
 */
const closes = (fence: { marker: string; info: string }, opener: string): boolean =>
  fence.info === "" && fence.marker[0] === opener[0] && fence.marker.length >= opener.length;

/** A block still being read. */
type OpenBlock = {
  readonly marker: string;
  readonly indent: number;
  readonly language: string;
  readonly line: number;
  readonly body: string[];
  readonly openers: number[];
};

/** A line read as a fence. */
type Fence = NonNullable<ReturnType<typeof fenceOf>>;

/**
 * The column a list item's content starts at after a line: a fence inside the item sits that far in.
 *
 * @param line - the line, outside any block.
 * @param margin - the column before it.
 */
const marginAfter = (line: string, margin: number): number => {
  const item = LIST_ITEM.exec(line)?.[1];
  if (item !== undefined) return item.length;
  return line.trim() !== "" && line.length - line.trimStart().length < margin ? 0 : margin;
};

/**
 * A block when it ends.
 *
 * @param open - the block.
 * @param isClosed - whether a closing fence ended it.
 */
const finished = (open: OpenBlock, isClosed: boolean): FencedBlock => ({
  language: open.language,
  line: open.line,
  body: open.body,
  isClosed,
  openersInside: open.openers
});

/**
 * Whether a fence read inside a block looks like one that opens another: a lost closing fence.
 *
 * @param fence - the fence, within the block's margin.
 * @param open - the block.
 */
const opensInside = (fence: Fence, open: OpenBlock): boolean =>
  fence.info !== "" && fence.marker[0] === open.marker[0] && fence.marker.length >= open.marker.length;

/**
 * Reads a Markdown text's fenced blocks and the prose around them.
 *
 * @param text - the text.
 */
export const markdownParts = (text: string): MarkdownParts => {
  const blocks: FencedBlock[] = [];
  const prose: Array<{ line: number; text: string }> = [];
  let open: OpenBlock | undefined;
  let margin = 0;
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const number = index + 1;
    const fence = fenceOf(line);
    if (open === undefined) {
      margin = marginAfter(line, margin);
      if (fence === undefined || fence.indent > margin + MAX_FENCE_INDENT) {
        prose.push({ line: number, text: line });
      } else {
        const language = fence.info.split(/\s/)[0]?.toLowerCase() ?? "";
        const { marker, indent } = fence;
        open = { marker, indent, language, line: number, body: [], openers: [] };
      }
      continue;
    }
    const inMargin = fence !== undefined && fence.indent <= open.indent + MAX_FENCE_INDENT;
    if (inMargin && closes(fence, open.marker)) {
      blocks.push(finished(open, true));
      open = undefined;
      continue;
    }
    if (inMargin && opensInside(fence, open)) open.openers.push(number);
    open.body.push(line.slice(Math.min(open.indent, line.length - line.trimStart().length)));
  }
  if (open !== undefined) blocks.push(finished(open, false));
  return { blocks, prose };
};

/**
 * A heading's anchor, made as GitHub and npm make them: lower case, punctuation gone, spaces as hyphens.
 *
 * @param heading - the heading's text, as written.
 */
export const headingAnchor = (heading: string): string =>
  heading
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "")
    .replace(/\s/g, "-");

/**
 * The anchors a text's headings give, a repeated heading numbered as GitHub numbers it (`usage`, `usage-1`).
 *
 * @param prose - the text's lines outside its blocks.
 */
const anchorsOf = (prose: MarkdownParts["prose"]): ReadonlySet<string> => {
  const anchors = new Set<string>();
  const seen = new Map<string, number>();
  for (const { text } of prose) {
    const heading = /^ {0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(text)?.[1];
    if (heading === undefined) continue;
    const anchor = headingAnchor(heading);
    const count = seen.get(anchor) ?? 0;
    seen.set(anchor, count + 1);
    anchors.add(count === 0 ? anchor : `${anchor}-${count}`);
  }
  return anchors;
};

/**
 * The problems of one YAML block.
 *
 * @param block - the block.
 * @param line - its opening fence's line in the file.
 */
const yamlProblems = (block: FencedBlock, line: number): readonly BlockProblem[] =>
  parseAllDocuments(block.body.join("\n")).flatMap((document) =>
    document.errors.map((error) => ({
      line: line + (error.linePos?.[0].line ?? 0),
      message: `invalid YAML: ${error.message.split("\n")[0] ?? error.code}`
    }))
  );

/**
 * The problems of one JSON block.
 *
 * @param block - the block.
 * @param line - its opening fence's line in the file.
 */
const jsonProblems = (block: FencedBlock, line: number): readonly BlockProblem[] => {
  try {
    JSON.parse(block.body.join("\n"));
    return [];
  } catch (error) {
    return [{ line, message: `invalid JSON: ${error instanceof Error ? error.message : String(error)}` }];
  }
};

/**
 * The problems of a text's blocks, a Markdown sample's own fences among them. A broken block's content is not parsed:
 * it holds whatever followed the lost fence, and the fence is the one thing to fix.
 *
 * @param blocks - the blocks.
 * @param offset - how many lines of the file come before the text.
 */
const blockProblems = (blocks: readonly FencedBlock[], offset: number): readonly BlockProblem[] =>
  blocks.flatMap((block) => {
    const line = block.line + offset;
    const fences: readonly BlockProblem[] = [
      ...(block.isClosed
        ? []
        : [{ line, message: "this fence is never closed: the rest of the file renders as code" }]),
      ...block.openersInside.map((inside) => ({
        line: inside + offset,
        message: `a fence opens inside the block of line ${line}: that block lost its closing fence, or needs a longer one around it`
      }))
    ];
    if (fences.length > 0) return fences;
    if (YAML_LANGUAGES.has(block.language)) return yamlProblems(block, line);
    if (block.language === "json") return jsonProblems(block, line);
    if (MARKDOWN_LANGUAGES.has(block.language)) {
      return blockProblems(markdownParts(block.body.join("\n")).blocks, line);
    }
    return [];
  });

/**
 * An anchor as a heading would give it: a link's percent escapes read, one that holds a stray `%` taken as written.
 *
 * @param anchor - the link's anchor.
 */
const decodedAnchor = (anchor: string): string => {
  try {
    return decodeURIComponent(anchor);
  } catch {
    return anchor;
  }
};

/**
 * Everything the check finds in a Markdown text: unbalanced fences, invalid YAML and JSON samples, and links to a
 * heading of the page that no heading outside a block answers.
 *
 * @param text - the text.
 * @returns the problems, by line.
 */
export const markdownProblems = (text: string): readonly BlockProblem[] => {
  const { blocks, prose } = markdownParts(text);
  const anchors = anchorsOf(prose);
  const links = prose.flatMap(({ line, text: content }) =>
    [...content.replace(/`[^`]*`/g, "").matchAll(/\]\(#([^)\s]+)/g)]
      .map((match) => match[1] ?? "")
      .filter((anchor) => !anchors.has(decodedAnchor(anchor)))
      .map((anchor) => ({ line, message: `the link to #${anchor} finds no heading outside a block` }))
  );
  return [...blockProblems(blocks, 0), ...links].sort((a, b) => a.line - b.line);
};
