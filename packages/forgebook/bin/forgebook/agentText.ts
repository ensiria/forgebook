/**
 * The answers of `forgebook stories`, `forgebook story`, `forgebook check` and `forgebook errors` as text for a
 * terminal: a table of the stories, one story's facts, a check's problems, the frames' errors, the pictures taken. Pure: documents in, text out, laid out with cli-kit's helpers.
 *
 * @remarks
 * Nothing is cut to the terminal's width: ids and links are what a reader copies, so a long line wraps instead.
 *
 * @module
 */
import { formatJson } from "@ensiria/cli-kit/files";
import { keyValue, table } from "@ensiria/cli-kit/layout";
import type { OutputStyle } from "@ensiria/cli-kit/log.types";

import type { StoryCheckReport, StoryShotReport } from "../../src/storyCheck.ts";
import type {
  AgentTokenSummary,
  CheckedCodeDocument,
  ErrorsDocument,
  FoundComponentsDocument,
  NearestTokensDocument,
  StoriesDocument,
  StoryDocument,
  TokensDocument
} from "../../src/vite/agent.types.ts";
import type { DesignToken } from "../../src/vite/designTokens.ts";

/** The style with no width to fit, so no cell is cut. */
const uncut = (style: OutputStyle): OutputStyle => ({ ...style, width: Number.POSITIVE_INFINITY });

/**
 * The stories as a table: one row per story, its id first (what `forgebook story` takes, never cut), then its
 * component's title and its name.
 *
 * @param document - the stories document.
 * @param style - colours, glyphs and width.
 */
export const storiesText = (document: StoriesDocument, style: OutputStyle): string =>
  table(
    document.components.flatMap((component) =>
      component.stories.map((story) => [
        story.id,
        `${component.title} › ${story.name}${story.isUnlisted ? " (unlisted)" : ""}`
      ])
    ),
    { columns: [{ header: "Id" }, { header: "Story", tone: "muted" }] },
    uncut(style)
  );

/**
 * One story's facts: where it is, where it opens, its args and its component's props.
 *
 * @param document - the story document.
 * @param style - colours, glyphs and width.
 */
export const storyText = (document: StoryDocument, style: OutputStyle): string => {
  const entries: (readonly [string, string])[] = [
    ["Story", `${document.component.title} › ${document.story.name}`],
    ["Id", document.story.id],
    ["File", document.component.file],
    ["Opens at", document.story.links.address],
    ["Frame", document.story.links.frame],
    ["Embed", document.story.links.embed],
    ["Args", JSON.stringify(document.args)],
    ["Props", document.docs === undefined ? "none" : document.docs.props.map((prop) => prop.name).join(", ")]
  ];
  if (document.story.description !== undefined) entries.push(["About", document.story.description]);
  return keyValue(entries, uncut(style));
};

/**
 * A check's report as a table: one row per problem, its story, its view and its kind; a story that passes in a view gets
 * one row saying so.
 *
 * @param report - the check's report.
 * @param style - colours, glyphs and width.
 */
export const checkText = (report: StoryCheckReport, style: OutputStyle): string =>
  table(
    report.results.flatMap((result) =>
      result.problems.length === 0
        ? [[result.storyId, result.view || "default", "passes"]]
        : result.problems.map((problem) => [
            result.storyId,
            result.view || "default",
            `${problem.kind}: ${problem.message}`
          ])
    ),
    { columns: [{ header: "Story" }, { header: "View", tone: "muted" }, { header: "Result" }] },
    uncut(style)
  );

/**
 * The frames' errors as a table: their number, the story, what went wrong; nothing when there are none.
 *
 * @param document - the errors document.
 * @param style - colours, glyphs and width.
 */
export const errorsText = (document: ErrorsDocument, style: OutputStyle): string =>
  document.errors.length === 0
    ? ""
    : table(
        document.errors.map((error) => [String(error.n), error.storyId, `${error.kind}: ${error.message}`]),
        { columns: [{ header: "#", tone: "muted" }, { header: "Story" }, { header: "Error" }] },
        uncut(style)
      );

/**
 * What `forgebook errors` prints of an answer: its JSON (one line per error while following, so each can be read as it
 * comes), or its table.
 *
 * @param document - the errors document.
 * @param mode - whether as JSON, and whether following.
 * @param style - colours, glyphs and width.
 */
export const errorsOutput = (
  document: ErrorsDocument,
  mode: { readonly isJson: boolean; readonly isFollowing: boolean },
  style: OutputStyle
): string => {
  if (!mode.isJson) return `${errorsText(document, style)}\n`;
  if (mode.isFollowing) return document.errors.map((error) => `${JSON.stringify(error)}\n`).join("");
  return formatJson(document);
};

/**
 * The pictures taken as a table: the story, the view, the file.
 *
 * @param report - the picture run's report.
 * @param shownFile - how a file is written for the reader (relative to where the command runs).
 * @param style - colours, glyphs and width.
 */
export const shotText = (
  report: StoryShotReport,
  shownFile: (file: string) => string,
  style: OutputStyle
): string =>
  table(
    report.shots.map((shot) => [shot.storyId, shot.view || "default", shownFile(shot.file)]),
    { columns: [{ header: "Story" }, { header: "View", tone: "muted" }, { header: "Picture" }] },
    uncut(style)
  );

/**
 * Tokens as a person reads them: one line each, how many there are when it is more than the list, and why when none.
 *
 * @param document - the answer.
 */
export const tokensText = (document: TokensDocument): string => {
  if (!document.isConfigured)
    return 'No tokens file: name one in forgebook.config.ts (`tokens: ["tokens.json"]`).';
  if (document.total === 0) return "No tokens here.";
  const lines = document.tokens.map((token) => tokenLine(token));
  const more = document.total - document.tokens.length;
  return [
    ...lines,
    ...(more > 0 ? [`… and ${more} more: narrow it with --category, or raise --limit.`] : [])
  ].join("\n");
};

/** A token on one line, its themes and any deprecation beside it. */
const tokenLine = (token: AgentTokenSummary): string => {
  const modes = Object.entries(token.modes).map(([mode, value]) => ` ${mode}: ${value}`);
  const deprecated = token.deprecated === undefined ? "" : `  deprecated: ${token.deprecated}`;
  const onlyThemes = token.isThemeOnly === true ? "  only in themes" : "";
  return `${token.name}  ${token.value}${modes.join("")}  (${token.type})${onlyThemes}${deprecated}`;
};

/**
 * One token as a person reads it.
 *
 * @param token - the token.
 */
export const tokenText = (token: DesignToken): string =>
  [
    tokenLine(token),
    ...(token.alias === undefined ? [] : [`alias of ${token.alias}`]),
    ...(token.description === undefined ? [] : [token.description])
  ].join("\n");

/**
 * The tokens nearest a value as a person reads them, saying which are really near.
 *
 * @param document - the answer.
 */
export const nearestTokensText = (document: NearestTokensDocument): string => {
  if (document.matches.length === 0)
    return `No ${document.type ?? ""} tokens to compare ${document.value} with.`;
  return document.matches
    .map((match) => {
      const where = match.mode === undefined ? "" : ` (${match.mode})`;
      const near = match.isClose ? "close" : "not close";
      return `${match.name}  ${match.value}${where}  ${match.isExact ? "exact" : `${near}, ${match.distance}`}`;
    })
    .join("\n");
};

/**
 * The components a query found as a person reads them, saying which words did not match.
 *
 * @param document - the answer.
 */
export const foundComponentsText = (document: FoundComponentsDocument): string =>
  document.components.length === 0
    ? `Nothing in this catalogue holds "${document.query}".`
    : document.components
        .map((each) => {
          const missed = each.missed.length === 0 ? "" : `  (no "${each.missed.join('", "')}")`;
          return `${each.title}${missed}${each.guidance?.deprecated === undefined ? "" : "  deprecated"}`;
        })
        .join("\n");

/**
 * What a change broke as a person reads it, a line a problem.
 *
 * @param document - the answer.
 */
export const checkedCodeText = (document: CheckedCodeDocument): string => {
  const lines = document.problems.map(
    (each) => `${each.file}${each.line === undefined ? "" : `:${each.line}`}  ${each.message}`
  );
  return [
    ...(lines.length === 0 ? ["Nothing to report."] : lines),
    ...document.skipped.map((each) => `Not checked: ${each}`)
  ].join("\n");
};
