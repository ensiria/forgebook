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
import { basename } from "node:path";

import { Marked, type Token, type Tokens } from "marked";

import { highlightCode } from "./highlightCode.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/** Markdown with GitHub's tables, its code blocks coloured. */
const markdown = new Marked({
  async: false,
  gfm: true,
  renderer: {
    code: ({ text, lang }: Tokens.Code): string => {
      const language = lang?.trim().split(/\s+/)[0] || undefined;
      const languageClass = language === undefined ? "" : ` class="language-${language}"`;
      return `<pre><code${languageClass}>${highlightCode(text, language)}</code></pre>\n`;
    }
  }
});

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
 * The documentation file beside a story file: its component's name in kebab case, with `.md`, in Vite's form.
 *
 * @param storyFile - the story file's absolute path.
 */
export const pageFileOf = (storyFile: string): string => {
  const component = basename(storyFile).replace(/\.stories\.tsx?$/, "");
  const kebab = component.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  return VITE_PATHS.join(VITE_PATHS.dirname(storyFile), `${kebab}.md`);
};

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
  return { html: markdown.parse(pageMarkdown(readFileSync(file, "utf8")), { async: false }), file };
};
