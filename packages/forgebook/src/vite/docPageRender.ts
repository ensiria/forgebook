/**
 * A docs page's nodes as the blocks the shell draws: text as HTML, code coloured with its lines marked, and each
 * container with its own blocks inside.
 *
 * @remarks
 * One renderer per page, made here, collects the page's headings in the order of the file, through every container,
 * so the contents list and the anchors agree with what is drawn. A heading links to itself rather than holding a
 * separate "link to this section" control: the heading's own words name the link for a screen reader, so the HTML, made
 * at build time, holds no text of the shell's. Anchors are made as GitHub makes them (`tokens`, `tokens-1`), so a link
 * written for a repository's reader keeps working here.
 *
 * @module
 */
import { Marked, type Token, type Tokens } from "marked";

import type { DocBlock, DocHeading } from "../docPages.ts";
import { fencedCode } from "./codeFence.ts";
import { codeHtml, headingAnchors } from "./componentPage.ts";
import { isValueToken, VALUES_EXTENSION } from "./docMarkdown.ts";
import type { PageNode } from "./docPageBlocks.ts";
import { type FenceRead, isCode } from "./docPageTokens.ts";
import { escapeHtml } from "./highlightCode.ts";

/**
 * What inline tokens say, without marks or raw HTML; a value as written, for the shell to fill.
 *
 * @param tokens - the tokens.
 */
const plainText = (tokens: readonly Token[]): string =>
  tokens
    .map((token): string => {
      if (token.type === "html") return "";
      if (isValueToken(token)) return token.name === "version" ? token.text : token.raw;
      const nested: unknown = "tokens" in token ? token.tokens : undefined;
      if (Array.isArray(nested) && nested.length > 0) return plainText(nested);
      return "text" in token && typeof token.text === "string" ? token.text : "";
    })
    .join("");

/**
 * The Markdown renderer of one page: it keeps the page's headings, so it is made for each page.
 *
 * @param headings - receives the page's second- and third-level headings.
 */
const pageRenderer = (headings: DocHeading[]): Marked => {
  const anchorOf = headingAnchors();
  return new Marked(VALUES_EXTENSION, {
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

/** A code block as the page draws it. */
const codeBlock = (token: Tokens.Code, fence: FenceRead | undefined): DocBlock => {
  const code = token.text;
  if (fence === undefined) return { kind: "code", text: code, html: escapeHtml(code) };
  if (fence.kind === "plugin")
    return { kind: "plugin", fence: fence.fence, argument: fence.argument, body: code };
  if (fence.kind !== "code") return { kind: fence.kind, id: fence.id };
  const drawn = fencedCode(code, fence.info);
  return {
    kind: "code",
    text: drawn.text,
    html: drawn.html,
    ...(drawn.language === undefined ? {} : { language: drawn.language }),
    ...(drawn.title === undefined ? {} : { title: drawn.title }),
    ...(drawn.isWrapped ? { isWrapped: true } : {})
  };
};

/**
 * Tokens in a page's own flow as blocks: each fence on its own, the text between them as HTML.
 *
 * @param tokens - the tokens.
 * @param renderer - the page's renderer.
 * @param fences - what each fence is.
 */
const tokenBlocks = (
  tokens: readonly Token[],
  renderer: Marked,
  fences: ReadonlyMap<Token, FenceRead>
): DocBlock[] => {
  const blocks: DocBlock[] = [];
  let text: Token[] = [];
  const flushText = (): void => {
    if (text.length === 0) return;
    blocks.push({ kind: "text", html: renderer.parser(text) });
    text = [];
  };
  for (const token of tokens) {
    if (token.type === "space") continue;
    if (!isCode(token)) {
      text.push(token);
      continue;
    }
    flushText();
    blocks.push(codeBlock(token, fences.get(token)));
  }
  flushText();
  return blocks;
};

/** Draws nodes as blocks. */
type DrawNodes = (nodes: readonly PageNode[]) => DocBlock[];

/**
 * A container's node as its block, what it holds drawn by `inner`.
 *
 * @param node - the node.
 * @param inner - draws what it holds.
 */
const containerBlock = (
  node: Extract<PageNode, { readonly type: "aside" | "tabs" | "cards" | "card" }>,
  inner: DrawNodes
): DocBlock => {
  switch (node.type) {
    case "aside":
      return {
        kind: "aside",
        tone: node.tone,
        ...(node.title === undefined ? {} : { title: node.title }),
        children: inner(node.children)
      };
    case "tabs":
      return {
        kind: "tabs",
        ...(node.sync === undefined ? {} : { sync: node.sync }),
        tabs: node.tabs.map((tab) => ({ label: tab.label, children: inner(tab.children) }))
      };
    case "cards":
      return { kind: "cards", children: inner(node.children) };
    default:
      return { kind: "card", title: node.title, children: inner(node.children) };
  }
};

/**
 * A page's nodes as blocks.
 *
 * @param nodes - the nodes.
 * @param renderer - the page's renderer.
 * @param fences - what each fence is.
 */
const nodeBlocks = (
  nodes: readonly PageNode[],
  renderer: Marked,
  fences: ReadonlyMap<Token, FenceRead>
): DocBlock[] =>
  nodes.flatMap((node): DocBlock[] => {
    switch (node.type) {
      case "tokens":
        return tokenBlocks(node.tokens, renderer, fences);
      case "steps":
        return [{ kind: "steps", steps: node.steps.map((step) => tokenBlocks(step, renderer, fences)) }];
      case "link-card":
        return [
          {
            kind: "link-card",
            title: node.title,
            href: node.href,
            ...(node.description === undefined ? {} : { description: node.description })
          }
        ];
      case "home":
        return [
          {
            kind: "home",
            piece: node.piece,
            ...(node.label === undefined ? {} : { label: node.label }),
            ...(node.source === undefined ? {} : { source: node.source })
          }
        ];
      case "problem":
        return [{ kind: "problem", message: node.message }];
      default:
        return [containerBlock(node, (children) => nodeBlocks(children, renderer, fences))];
    }
  });

/**
 * A page's nodes as the blocks the shell draws, and its headings.
 *
 * @param nodes - the page's nodes.
 * @param fences - what each of its fences is.
 */
export const renderedPage = (
  nodes: readonly PageNode[],
  fences: ReadonlyMap<Token, FenceRead>
): { readonly blocks: DocBlock[]; readonly headings: DocHeading[] } => {
  const headings: DocHeading[] = [];
  const blocks = nodeBlocks(nodes, pageRenderer(headings), fences);
  return { blocks, headings };
};
