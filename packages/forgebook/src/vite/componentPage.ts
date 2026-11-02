/**
 * A component's page text: its Markdown documentation beside its story file (`Counter.stories.tsx` → `counter.md`),
 * as HTML for the catalogue's component page.
 *
 * @remarks
 * The title is left out (the page's header shows the name) and so is the `## Props` section: the page draws the props
 * from the component's types, which a table written by hand would only repeat and drift from. Everything else (the
 * introduction, the usage, Accessibility, Parts and styling, Test ids) follows the demo, its code blocks coloured
 * (`highlightCode.ts`). The page's lead is the component's TSDoc summary, not the file's opening: that summary is
 * written for whoever uses the component, the file's opening often for whoever builds it. The files are the
 * package's, read at build time, so their HTML is trusted as the stories' code is.
 *
 * @module
 */
import { existsSync, readFileSync } from "node:fs";

import { Marked, type Token, type Tokens } from "marked";

import { headingElementId } from "../docPages.ts";
import { escapeHtml, highlightCode } from "./highlightCode.ts";
import { pageFileOf } from "./pageFile.ts";

/**
 * A Markdown code block as HTML, coloured when its fence names a language.
 *
 * @param token - the block.
 */
export const codeHtml = ({ text, lang }: Tokens.Code): string => {
  const language = lang?.trim().split(/\s+/)[0] || undefined;
  const languageClass = language === undefined ? "" : ` class="language-${escapeHtml(language)}"`;
  return `<pre><code${languageClass}>${highlightCode(text, language)}</code></pre>\n`;
};

/** Markdown with GitHub's tables, its code blocks coloured. */
const markdown = new Marked({ async: false, gfm: true, renderer: { code: codeHtml } });

/**
 * A page's anchors, made from its headings as GitHub makes them (`tokens`, `tokens-1`), so a link written for a
 * repository's reader keeps working here. One per page: it counts the headings it saw.
 *
 * @returns what gives a heading's text its anchor.
 */
export const headingAnchors = (): ((text: string) => string) => {
  const seen = new Set<string>();
  return (text: string): string => {
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
};

/** The Markdown of one component's page: its headings carry their anchors, and take the focus when a search opens one. */
const componentPageRenderer = (): Marked => {
  const anchorOf = headingAnchors();
  return new Marked({
    async: false,
    gfm: true,
    renderer: {
      code: codeHtml,
      heading({ tokens, depth }: Tokens.Heading): string {
        const anchor = anchorOf(this.parser.parseInline(tokens, this.parser.textRenderer));
        const id = escapeHtml(headingElementId(anchor));
        return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      }
    }
  });
};

/** A component's page text, as HTML. */
export type ComponentPageText = {
  /** The text. */
  readonly html: string;
  /** The documentation file it came from, watched in development. */
  readonly file: string;
};

/** The Markdown sections the page draws from the component's types instead. */
const GENERATED_SECTIONS = ["Props"];

/**
 * A Markdown text without its first `# ` title: the catalogue shows the name above it.
 *
 * @param markdown - the text.
 */
const withoutTitle = (markdown: string): string => {
  const lines = markdown.split("\n");
  const title = lines.findIndex((line) => line.startsWith("# "));
  return (title === -1 ? lines : [...lines.slice(0, title), ...lines.slice(title + 1)]).join("\n").trim();
};

/**
 * The page's Markdown: without its first `# ` title and without the sections drawn from the types.
 *
 * @param markdown - the documentation file's text.
 */
export const pageMarkdown = (markdown: string): string => {
  const kept: string[] = [];
  let isSkipping = false;
  for (const line of withoutTitle(markdown).split("\n")) {
    if (line.startsWith("## ")) isSkipping = GENERATED_SECTIONS.includes(line.slice(3).trim());
    if (!isSkipping) kept.push(line);
  }
  return kept.join("\n").trim();
};

/**
 * A Markdown file as HTML, its first `#` title left out and its headings one level down: a source's introduction on
 * the catalogue's home, which sits under the source's own heading, so the file's `##` sections are its parts.
 *
 * @param text - the file's text.
 */
export const markdownHtml = (text: string): string =>
  markdown.parse(withoutTitle(text), {
    async: false,
    walkTokens: (token: Token): void => {
      if (token.type === "heading") token.depth = Math.min(token.depth + 1, 6);
    }
  });

/**
 * The page's text, read from the documentation file beside a story file.
 *
 * @param storyFile - the story file's absolute path.
 * @returns the HTML and the file it came from, or none when the component has no documentation file.
 */
export const componentPage = (storyFile: string): ComponentPageText | undefined => {
  const file = pageFileOf(storyFile);
  if (!existsSync(file)) return undefined;
  const html = componentPageRenderer().parse(pageMarkdown(readFileSync(file, "utf8")), { async: false });
  return { html, file };
};
