/**
 * A docs page read into its blocks, before any HTML: each directive given its meaning, each fence its kind, each link
 * and image checked and addressed, and everything wrong noted with its line and column.
 *
 * @remarks
 * One reading serves both the index (what the sidebar and the checks need, nothing rendered) and the page itself
 * (`docPageRender.ts` turns the nodes into HTML), so the two never disagree about what a page holds or gets wrong. The
 * names a page can use are fixed here: asides by tone, `tabs`, `steps`, `cards`, `card` and `link-card`, and on the
 * written home the pieces of today's home. A block that cannot be read keeps its content as text and is reported, so a
 * mistake never blanks a page.
 *
 * @module
 */
import type { Token } from "marked";

import { ASIDE_TONES, type AsideTone, HOME_PIECES, type HomePiece } from "../docPages.ts";
import {
  type BodySegment,
  type Directive,
  noteText,
  type SourceLine,
  type SourcePosition
} from "./docDirectives.ts";
import { isPageValue } from "./docMarkdown.ts";
import { isPageLink, linkedSlug, pageAddress } from "./docPageLinks.ts";
import { isOrderedList, lexed, type PageReading, positionsOf, readTokens } from "./docPageTokens.ts";

/** A piece of a page read, before its HTML. */
export type PageNode =
  | { readonly type: "tokens"; readonly tokens: readonly Token[] }
  | {
      readonly type: "aside";
      readonly tone: AsideTone;
      readonly title?: string;
      readonly children: PageNode[];
    }
  | {
      readonly type: "tabs";
      readonly sync?: string;
      readonly tabs: readonly { readonly label: string; readonly children: PageNode[] }[];
    }
  | { readonly type: "steps"; readonly steps: readonly (readonly Token[])[] }
  | { readonly type: "cards"; readonly children: PageNode[] }
  | { readonly type: "card"; readonly title: string; readonly children: PageNode[] }
  | {
      readonly type: "link-card";
      readonly title: string;
      readonly href: string;
      readonly description?: string;
    }
  | { readonly type: "home"; readonly piece: HomePiece; readonly label?: string; readonly source?: string }
  | { readonly type: "problem"; readonly message: string };

/** The tone each GitHub alert takes: its warning is a caution, its caution a danger, as their colours say. */
const ALERT_TONES: Readonly<Record<string, AsideTone>> = {
  NOTE: "note",
  TIP: "tip",
  IMPORTANT: "important",
  WARNING: "caution",
  CAUTION: "danger"
};

/** The names of the blocks a page can write, for the note about one it cannot. */
const KNOWN_BLOCKS = [...ASIDE_TONES, "tabs", "tab", "steps", "cards", "card"].map((name) => `:::${name}`);

/** The leaf blocks a page can write, for the same note. */
const KNOWN_LEAVES = ["link-card", ...HOME_PIECES].map((name) => `::${name}`);

/** The pieces of the home that take a heading of their own. */
const LABELLED_PIECES: readonly HomePiece[] = ["recent", "families", "pages"];

/** The addresses a link card may open: another site, or an address of the catalogue; never `//host` or `/\host`, another site in disguise. */
const CARD_ADDRESS = /^(https?:|mailto:|\?|#|\/(?![/\\]))/i;

/** The asides other tools name otherwise, by those names. */
const OTHER_NAMES: Readonly<Record<string, AsideTone>> = {
  warning: "caution",
  info: "note",
  error: "danger",
  success: "tip"
};

/** A hint at the aside another tool's name means, for the note about it; empty for any other name. */
const similarTo = (name: string): string => {
  const tone = OTHER_NAMES[name];
  return tone === undefined ? "" : ` (for this aside, write \`:::${tone}\`)`;
};

/** Whether a tone is an aside's. */
const isTone = (name: string): name is AsideTone => ASIDE_TONES.some((tone) => tone === name);

/** Whether a name is a piece of the home. */
const isHomePiece = (name: string): name is HomePiece => HOME_PIECES.some((piece) => piece === name);

/** Whether a segment is Markdown with nothing in it. */
const isBlank = (segment: BodySegment): boolean =>
  segment.type === "markdown" && segment.lines.every((line) => line.text.trim() === "");

/** Where a segment starts. */
const segmentPosition = (segment: BodySegment): SourcePosition => {
  if (segment.type === "container" || segment.type === "leaf") return segment.directive.position;
  if (segment.type === "alert") return segment.position;
  const line = segment.lines.find((each) => each.text.trim() !== "") ?? segment.lines[0];
  return line === undefined ? { line: 1, column: 1 } : { line: line.line, column: line.column };
};

/** Notes a directive's attributes beyond those its block takes. */
const checkAttributes = (directive: Directive, allowed: readonly string[], reading: PageReading): void => {
  for (const [key, { position }] of directive.attributes) {
    if (allowed.includes(key)) continue;
    const takes =
      allowed.length === 0 ? "it takes none" : `it takes ${allowed.map((each) => `"${each}"`).join(", ")}`;
    reading.notes.push({ position, message: `\`${directive.name}\` has no attribute "${key}": ${takes}` });
  }
};

/** A directive's attribute's value; none when it does not have it. */
const attributeOf = (directive: Directive, key: string): string | undefined =>
  directive.attributes.get(key)?.value;

/**
 * A directive's label as plain text: `{{version}}` written in, another value kept for the shell to fill, a name no
 * page can use reported.
 */
const labelText = (directive: Directive, reading: PageReading): string | undefined => {
  const { label, labelPosition } = directive;
  return label === undefined ? undefined : valuesIn(label, labelPosition, reading);
};

/**
 * A plain text of a block (its label, a card's description) with `{{version}}` written in, another value kept for the
 * shell to fill, and a name no page can use reported.
 *
 * @param text - the text.
 * @param start - where it starts, for the notes; none when unknown.
 * @param reading - the reading.
 */
const valuesIn = (text: string, start: SourcePosition | undefined, reading: PageReading): string =>
  text.replace(/\{\{\s*([A-Za-z][\w-]*)\s*\}\}/g, (written: string, name: string, offset: number) => {
    if (!isPageValue(name)) {
      if (start !== undefined)
        reading.notes.push({
          position: { line: start.line, column: start.column + offset },
          message: `\`${written}\` is not a value a page can show`
        });
      return written;
    }
    return name === "version" ? (reading.version() ?? "") : written;
  });

/** A Markdown segment read. */
const markdownNode = (lines: readonly SourceLine[], reading: PageReading): PageNode => {
  const { text, tokens } = lexed(lines);
  readTokens(tokens, text, 0, positionsOf(lines), reading);
  return { type: "tokens", tokens };
};

/** The segments of a container read, blank Markdown left out. */
const nodesOf = (segments: readonly BodySegment[], reading: PageReading): PageNode[] =>
  segments.flatMap((segment) => (isBlank(segment) ? [] : segmentNodes(segment, reading)));

/** A `tabs` block read: its `:::tab` blocks, anything else reported. */
const tabsNode = (directive: Directive, children: readonly BodySegment[], reading: PageReading): PageNode => {
  checkAttributes(directive, ["syncKey"], reading);
  const tabs: { label: string; children: PageNode[] }[] = [];
  for (const child of children) {
    if (isBlank(child)) continue;
    if (child.type !== "container" || child.directive.name !== "tab") {
      reading.notes.push({
        position: segmentPosition(child),
        message: `only \`:::tab\` blocks go in \`tabs\` (line ${directive.position.line}): this is left out`
      });
      continue;
    }
    checkAttributes(child.directive, [], reading);
    const label = labelText(child.directive, reading);
    if (label === undefined || label.trim() === "")
      reading.notes.push({
        position: child.directive.position,
        message: "a tab needs its label: `:::tab[npm]`"
      });
    tabs.push({
      label: label?.trim() || String(tabs.length + 1),
      children: nodesOf(child.children, reading)
    });
  }
  if (tabs.length === 0)
    reading.notes.push({ position: directive.position, message: "`tabs` holds no `:::tab`" });
  const sync = attributeOf(directive, "syncKey");
  return { type: "tabs", ...(sync === undefined || sync === "" ? {} : { sync }), tabs };
};

/** A `steps` block read: one ordered list, each item a step; anything else drawn as it is, and reported. */
const stepsNodes = (
  directive: Directive,
  children: readonly BodySegment[],
  reading: PageReading
): PageNode[] => {
  checkAttributes(directive, [], reading);
  const filled = children.filter((child) => !isBlank(child));
  const only = filled[0];
  if (filled.length === 1 && only?.type === "markdown") {
    const { text, tokens } = lexed(only.lines);
    const content = tokens.filter((token) => token.type !== "space");
    const list = content[0];
    if (content.length === 1 && isOrderedList(list)) {
      const at = positionsOf(only.lines);
      const listStart = Math.max(0, text.indexOf(list.raw));
      let cursor = 0;
      const steps = list.items.map((item) => {
        const place = list.raw.indexOf(item.raw, cursor);
        cursor = place === -1 ? cursor : place;
        readTokens(item.tokens, item.raw, listStart + cursor, at, reading);
        return item.tokens;
      });
      return [{ type: "steps", steps }];
    }
  }
  reading.notes.push({
    position: directive.position,
    message: "`steps` holds one numbered list, each item a step: this one is drawn as it is"
  });
  return nodesOf(children, reading);
};

/** A `cards` block read: its cards, anything else reported and drawn as it is. */
const cardsNode = (
  directive: Directive,
  children: readonly BodySegment[],
  reading: PageReading
): PageNode => {
  checkAttributes(directive, [], reading);
  for (const child of children) {
    if (isBlank(child)) continue;
    const isCard =
      (child.type === "container" && child.directive.name === "card") ||
      (child.type === "leaf" && child.directive.name === "link-card");
    if (!isCard)
      reading.notes.push({
        position: segmentPosition(child),
        message: "only `:::card` and `::link-card` blocks go in `cards`"
      });
  }
  return { type: "cards", children: nodesOf(children, reading) };
};

/** A link card's address checked: another page by its file, an address of the catalogue, or another site. */
const cardAddress = (href: string, position: SourcePosition, reading: PageReading): string | undefined => {
  if (isPageLink(href)) {
    const address = pageAddress(reading.file, href, reading.read);
    if (address === undefined) {
      reading.notes.push({ position, message: `the card links to "${href}", which is not there` });
      return undefined;
    }
    const slug = linkedSlug(reading.file, href, reading.read);
    if (slug !== undefined) reading.links.push(slug);
    return address;
  }
  if (CARD_ADDRESS.test(href)) return href;
  reading.notes.push({
    position,
    message: `the card's "${href}" is no page or address: link a page's file, an address of the catalogue (?component=…) or a site`
  });
  return undefined;
};

/** A problem said in place, and noted. */
const problemAt = (position: SourcePosition, message: string, reading: PageReading): PageNode[] => {
  const note = { position, message };
  reading.notes.push(note);
  return [{ type: "problem", message: noteText(note) }];
};

/** A link card read: its title, its address checked, its description. */
const linkCardNodes = (directive: Directive, reading: PageReading): PageNode[] => {
  const { position } = directive;
  checkAttributes(directive, ["href", "description"], reading);
  const title = labelText(directive, reading)?.trim() ?? "";
  const written = attributeOf(directive, "href") ?? "";
  if (title === "" || written === "")
    return problemAt(
      position,
      'a link card needs a title and an address: `::link-card[Theming]{href="./theming.md"}`',
      reading
    );
  const href = cardAddress(written, directive.attributes.get("href")?.position ?? position, reading);
  if (href === undefined) return [];
  const described = directive.attributes.get("description");
  const description =
    described === undefined ? undefined : valuesIn(described.value, described.valuePosition, reading);
  return [{ type: "link-card", title, href, ...(description === undefined ? {} : { description }) }];
};

/** A piece of the home read: drawn on the written home only, reported anywhere else. */
const homePieceNodes = (piece: HomePiece, directive: Directive, reading: PageReading): PageNode[] => {
  const { position } = directive;
  if (!reading.isHome)
    return problemAt(position, `\`::${piece}\` is drawn only on the catalogue's home`, reading);
  checkAttributes(directive, piece === "recent" ? [] : ["source"], reading);
  const isLabelled = LABELLED_PIECES.includes(piece);
  const label = labelText(directive, reading);
  if (label !== undefined && !isLabelled)
    reading.notes.push({
      position,
      message: `\`::${piece}\` takes no label: each library has its own heading`
    });
  const source = piece === "recent" ? undefined : attributeOf(directive, "source");
  if (source !== undefined) reading.sources.push(source);
  return [
    {
      type: "home",
      piece,
      ...(label === undefined || !isLabelled ? {} : { label }),
      ...(source === undefined ? {} : { source })
    }
  ];
};

/** A leaf directive read. */
const leafNodes = (directive: Directive, reading: PageReading): PageNode[] => {
  const { name, position } = directive;
  if (name === "link-card") return linkCardNodes(directive, reading);
  if (isHomePiece(name)) return homePieceNodes(name, directive, reading);
  if (isTone(name) || ["tabs", "tab", "steps", "cards", "card"].includes(name))
    return problemAt(
      position,
      `\`::${name}\` is a block that holds others: write \`:::${name}\`, then a line of \`:::\``,
      reading
    );
  reading.notes.push({
    position,
    message: `\`::${name}\` is not a block Forgebook knows: ${KNOWN_LEAVES.join(", ")}; or a container, ${KNOWN_BLOCKS.join(", ")}; it stays as text`
  });
  return [markdownNode([directive.line], reading)];
};

/** A container directive read. */
const containerNodes = (
  directive: Directive,
  children: readonly BodySegment[],
  reading: PageReading
): PageNode[] => {
  const { name, position } = directive;
  if (isTone(name)) {
    checkAttributes(directive, [], reading);
    const title = labelText(directive, reading)?.trim();
    return [{ type: "aside", tone: name, ...(title ? { title } : {}), children: nodesOf(children, reading) }];
  }
  switch (name) {
    case "tabs":
      return [tabsNode(directive, children, reading)];
    case "steps":
      return stepsNodes(directive, children, reading);
    case "cards":
      return [cardsNode(directive, children, reading)];
    case "card": {
      checkAttributes(directive, [], reading);
      const title = labelText(directive, reading)?.trim() ?? "";
      if (title === "")
        reading.notes.push({ position, message: "a card needs its title: `:::card[Install]`" });
      return [{ type: "card", title, children: nodesOf(children, reading) }];
    }
    case "tab":
      reading.notes.push({
        position,
        message: "`:::tab` goes inside `::::tabs`: its content is drawn as it is"
      });
      return nodesOf(children, reading);
    default: {
      const isLeaf = name === "link-card" || isHomePiece(name);
      reading.notes.push({
        position,
        message: isLeaf
          ? `\`${name}\` stands alone: write \`::${name}\` on one line, with no closing line`
          : `\`:::${name}\` is not a block Forgebook knows${similarTo(name)}: ${KNOWN_BLOCKS.join(", ")}; its content is drawn as it is`
      });
      return nodesOf(children, reading);
    }
  }
};

/**
 * A segment of a page read into its nodes.
 *
 * @param segment - the segment.
 * @param reading - the reading.
 */
const segmentNodes = (segment: BodySegment, reading: PageReading): PageNode[] => {
  switch (segment.type) {
    case "markdown":
      return [markdownNode(segment.lines, reading)];
    case "alert":
      return [
        {
          type: "aside",
          tone: ALERT_TONES[segment.kind] ?? "note",
          children: nodesOf(segment.children, reading)
        }
      ];
    case "leaf":
      return leafNodes(segment.directive, reading);
    default:
      return containerNodes(segment.directive, segment.children, reading);
  }
};

/**
 * A page's segments read into its nodes.
 *
 * @param segments - the page's segments.
 * @param reading - the reading.
 */
export const pageNodes = (segments: readonly BodySegment[], reading: PageReading): PageNode[] =>
  nodesOf(segments, reading);
