/**
 * What a page drawn for one audience reads: which sections, in what order, the part of the documentation file it
 * shows, the tokens named after its component, and its texts. Each audience is one row of a table, the same page
 * reordered and filtered.
 *
 * @remarks
 * The sections sit in three places around the frames, because the frames must never move: an `iframe` moved in the
 * document loads again, losing its story's state and costing a load per story for a change of reading. So the demo
 * and the examples stay where they are, and only what goes around them changes. `everyone` is not here: its page is
 * `ComponentPage.tsx`'s own, and all of this loads with the first page drawn for someone else. Nothing records which
 * tokens a component's styles use, so a token belongs to a component by its name, the way a tokens file groups them:
 * `select.border` and `component.select.height` are the Select's. Pure, the texts aside.
 *
 * @module
 */
import type { AudienceId } from "../audiences.ts";
import { textsOfGroup } from "./strings.ts";

/** A part of the page around its frames. */
export type PageSection =
  | "lead"
  | "guidance"
  | "prose"
  | "api"
  | "parts"
  | "pages"
  | "tokens"
  | "coverage"
  | "usedIn";

/** What of the documentation file an audience sees: all of it, without what is about code, or what testing reads. */
export type ProseReading = "whole" | "design" | "testing";

/** An audience's page. */
export type AudiencePage = {
  /** The sections above the demo, in their order. */
  readonly beforeDemo: readonly PageSection[];
  /** The sections between the demo and the examples. */
  readonly afterDemo: readonly PageSection[];
  /** The sections after the examples. */
  readonly afterExamples: readonly PageSection[];
  /** What of the documentation file it sees. */
  readonly prose: ProseReading;
};

/** Each audience's page. */
export const AUDIENCE_PAGES: Readonly<Record<Exclude<AudienceId, "everyone">, AudiencePage>> = {
  designer: {
    beforeDemo: ["lead", "guidance"],
    afterDemo: ["prose", "pages", "tokens"],
    afterExamples: ["usedIn"],
    prose: "design"
  },
  coder: {
    beforeDemo: ["lead", "api", "parts"],
    afterDemo: ["prose"],
    afterExamples: ["usedIn"],
    prose: "whole"
  },
  tester: {
    beforeDemo: ["lead", "coverage"],
    afterDemo: ["prose", "parts"],
    afterExamples: [],
    prose: "testing"
  }
};

/** A section of a documentation file: its heading, empty for what comes before the first one, and its HTML. */
export type ProsePart = {
  /** Its `##` heading as written, lower case. */
  readonly heading: string;
  /** Its HTML, the heading's included. */
  readonly html: string;
};

/** Where a `##` heading starts. The plugin escapes code blocks, so a real one is all this finds. */
const SECTION_START = /(?=<h2[\s>])/;

/** The heading inside a section's HTML. */
const HEADING = /^<h2[^>]*>(.*?)<\/h2>/s;

/**
 * A heading's words, lower case: every other piece around `<` and `>` is a tag, so a link's address reads as no word.
 *
 * @param html - the heading's HTML.
 */
const headingText = (html: string): string =>
  html
    .split(/[<>]/)
    .filter((_piece, index) => index % 2 === 0)
    .join("")
    .toLowerCase();

/**
 * A documentation file's HTML in its `##` sections.
 *
 * @param html - the file's HTML.
 */
export const proseParts = (html: string): ProsePart[] =>
  html
    .split(SECTION_START)
    .filter((part) => part.trim() !== "")
    .map((part) => ({
      heading: headingText(HEADING.exec(part)?.[1] ?? ""),
      html: part
    }));

/** The headings of the sections written for whoever codes: what a designer leaves out. */
const CODE_HEADINGS = /\b(parts|styling|test[ -]?ids?|hooks?|api|props)\b/;

/** The headings of the sections a tester reads. */
const TEST_HEADINGS = /\b(accessibility|a11y|keyboard|states?|test[ -]?ids?|testing)\b/;

/** Where a code block starts. */
const CODE_START = /(?=<pre[\s>])/;

/** The end of a code block: `pre` holds no other. */
const CODE_END = "</pre>";

/**
 * A section's HTML without its code blocks; nothing when only its heading is left.
 *
 * @param html - the section's HTML.
 */
const withoutCode = (html: string): string => {
  const text = html
    .split(CODE_START)
    .map((piece) =>
      piece.startsWith("<pre") ? piece.slice(piece.indexOf(CODE_END) + CODE_END.length) : piece
    )
    .join("");
  return text.replace(HEADING, "").trim() === "" ? "" : text;
};

/**
 * What of a documentation file an audience sees. Its sections are told apart by their headings, in the English words
 * the conventional sections use. A section with another name stays for a designer; a tester gets the sections the
 * words find, and all of the file when they find none, since a file in another language must not read as empty.
 *
 * @param html - the file's HTML.
 * @param reading - what the audience sees.
 * @returns the HTML; empty when nothing is left.
 */
export const proseFor = (html: string, reading: ProseReading): string => {
  if (reading === "whole") return html;
  const parts = proseParts(html);
  if (reading === "testing") {
    const tested = parts.filter((part) => TEST_HEADINGS.test(part.heading));
    return tested.length === 0 ? html : tested.map((part) => part.html).join("");
  }
  return parts
    .filter((part) => !CODE_HEADINGS.test(part.heading))
    .map((part) => withoutCode(part.html))
    .join("");
};

/** A token as the plugin's module gives it: what a person reads. */
export type ShellToken = {
  /** Its name, the groups joined by dots. */
  readonly name: string;
  /** Its type (`color`, `dimension`…). */
  readonly type: string;
  /** Its value, as CSS writes it. */
  readonly value: string;
  /** Its value in each theme where it differs, by theme. */
  readonly modes: Readonly<Record<string, string>>;
  /** Why not to use it, when it is deprecated. */
  readonly deprecated?: string;
};

/** What the plugin's module exports. */
export type ShellTokens = {
  /** The tokens, in the files' order. */
  readonly tokens: readonly ShellToken[];
  /** What could not be used, one line each. */
  readonly problems: readonly string[];
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a value is one token. */
const isShellToken = (value: unknown): value is ShellToken =>
  isRecord(value) &&
  typeof value["name"] === "string" &&
  typeof value["type"] === "string" &&
  typeof value["value"] === "string" &&
  isRecord(value["modes"]) &&
  (value["deprecated"] === undefined || typeof value["deprecated"] === "string");

/**
 * Whether a value is what the plugin's module exports.
 *
 * @param value - the module's default export, unchecked.
 */
export const isShellTokens = (value: unknown): value is ShellTokens =>
  isRecord(value) &&
  Array.isArray(value["tokens"]) &&
  value["tokens"].every(isShellToken) &&
  Array.isArray(value["problems"]) &&
  value["problems"].every((problem) => typeof problem === "string");

/**
 * The tokens named after a component: a segment of the name is its name, in any case, or in kebab case.
 *
 * @param tokens - the tokens.
 * @param name - the component's name (`BottomSheet`).
 */
export const tokensAbout = <TToken extends Pick<ShellToken, "name">>(
  tokens: readonly TToken[],
  name: string
): TToken[] => {
  const names = [name.toLowerCase(), name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()];
  return tokens.filter((token) =>
    token.name
      .toLowerCase()
      .split(".")
      .some((segment) => names.includes(segment))
  );
};

/** The texts, as shown. */
export const AUDIENCE_TEXTS = textsOfGroup("audienceTexts", {
  audienceNote: (audience: string): string =>
    `Reading for ${audience.toLowerCase()}: this page shows part of what it holds.`,
  audienceShowAll: "Show everything",
  guidance: "When to use it",
  guidanceUse: "Use it when",
  guidanceAvoid: "Avoid it when",
  guidanceAlternatives: "Alternatives",
  guidanceDeprecated: "Deprecated",
  guidanceReplacedBy: "Use instead",
  aboutPages: "Read more",
  tokens: "Design tokens",
  tokenName: "Token",
  tokenValue: "Value",
  tokensOther: (count: number): string =>
    `${count === 1 ? "1 token" : `${count} tokens`} of the whole catalogue`,
  tokensMore: (count: number): string => `And ${count} more: \`forgebook tokens\` lists them.`,
  tokensError: "The tokens could not be read",
  partsTitle: "Parts and styling",
  coverage: "What the stories cover",
  coverageSummary: (stories: number, played: number, untested: number): string =>
    `${stories === 1 ? "1 story" : `${stories} stories`}: ${played} with a play function, ${untested} left out of the generated tests.`,
  coverageStory: "Story",
  coverageGroup: "Group",
  coveragePlay: "Play",
  coverageTests: "Generated tests",
  coverageA11y: "Accessibility",
  coverageHasPlay: "Plays",
  coverageNoPlay: "None",
  coverageTested: "Included",
  coverageUntested: "Left out",
  coverageNotChecked: "Not checked",
  coverageChecking: "Checking",
  coverageFailed: "Could not load",
  coverageCheckAll: "Check every story",
  coverageChecked: (done: number, total: number): string => `${done} of ${total} checked`
});
