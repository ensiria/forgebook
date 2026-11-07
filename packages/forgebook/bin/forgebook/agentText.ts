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

import type { ComponentDocs, PropCondition, PropsNote } from "../../src/componentDocs.ts";
import type {
  StoryCheckReport,
  StoryCheckResult,
  StoryDiffReport,
  StoryShotReport
} from "../../src/storyCheck.ts";
import type {
  AgentTokenSummary,
  CheckedCodeDocument,
  ErrorsDocument,
  FoundComponentsDocument,
  NearestTokensDocument,
  PageDocument,
  PagesDocument,
  PluginsDocument,
  SearchDocument,
  StoriesDocument,
  StoryDocument,
  SwitchesDocument,
  TokensDocument,
  UnseenComponent,
  VerifyDocument,
  VisibilityDocument
} from "../../src/vite/agent.types.ts";
import type { DesignToken, TokenSource } from "../../src/vite/designTokens.ts";
import type { TokenClash } from "../../src/vite/tokenClashes.ts";

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

/** Why a component lists no props, as the `Props` line says it. */
const PROPS_NOTES: Readonly<Record<PropsNote["reason"], (count: number) => string>> = {
  untyped: (): string => "none: its props are typed any",
  "no-signature": (): string => "none: its type cannot be called with props",
  "outside-package": (count: number): string => `none: all ${count} come from outside the package`
};

/** When a variant's prop applies, as the `Props` line says it (`mode is single, or left out`). */
const conditionText = ({ prop, values, orOmitted }: PropCondition): string => {
  if (values.length === 0) return `${prop} is left out`;
  return `${prop} is ${values.map(String).join(" or ")}${orOmitted === true ? ", or left out" : ""}`;
};

/**
 * A component's props in one line: each name, a variant's with when it can be passed, or why there are none.
 *
 * @param docs - the component's docs.
 */
const propsLine = (docs: ComponentDocs): string => {
  const { propsNote } = docs;
  if (docs.props.length === 0 && propsNote !== undefined) {
    return PROPS_NOTES[propsNote.reason](propsNote.reason === "outside-package" ? propsNote.count : 0);
  }
  return docs.props
    .map((prop) =>
      prop.onlyWhen === undefined ? prop.name : `${prop.name} (when ${conditionText(prop.onlyWhen)})`
    )
    .join(", ");
};

/**
 * One story's facts: where it is, where it opens, its args, its component's props and those every use must set, then
 * its code.
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
    ["Props", document.docs === undefined ? "none" : propsLine(document.docs)],
    ["Required", document.requiredProps.length === 0 ? "none" : document.requiredProps.join(", ")]
  ];
  if (document.story.description !== undefined) entries.push(["About", document.story.description]);
  if (document.design !== undefined) entries.push(["Design", document.design.figma]);
  const fields = keyValue(entries, uncut(style));
  // the code spans lines: under the fields, as it is copied
  return document.code === undefined ? fields : `${fields}\n\n${document.code}`;
};

/** What a model judged, each line saying it is an opinion. */
const judgementLines = (result: StoryCheckResult): readonly string[][] => {
  const row = (text: string): string[] => [
    result.storyId,
    result.view || "default",
    `model's opinion: ${text}`
  ];
  const { judgements } = result;
  if (judgements === undefined) return [];
  if (typeof judgements === "string") return [row(judgements)];
  return judgements.length === 0
    ? [row("nothing to report")]
    : judgements.map((each) => row(`${each.criterion} ${each.message}`.trim()));
};

/**
 * A check's report as a table: one row per problem, its story, its view and its kind; a story that passes in a view gets
 * one row saying so. A catalogue that checks no accessibility says so first, so "passes" is not read as axe's.
 *
 * @param report - the check's report.
 * @param style - colours, glyphs and width.
 */
export const checkText = (report: StoryCheckReport, style: OutputStyle): string =>
  (report.a11y === "off" ? "Accessibility is not checked: the catalogue sets a11y: false.\n" : "") +
  table(
    report.results.flatMap((result) => [
      ...(result.notVerified === undefined
        ? []
        : [[result.storyId, result.view || "default", `not verified: ${result.notVerified}`]]),
      ...(result.problems.length === 0 && result.notVerified === undefined
        ? [
            [
              result.storyId,
              result.view || "default",
              result.isNotAwaited === true ? "passes, as drawn: parameters.suspense.expected" : "passes"
            ]
          ]
        : result.problems.map((problem) => [
            result.storyId,
            result.view || "default",
            `${problem.kind}: ${problem.message}`
          ])),
      ...judgementLines(result)
    ]),
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
        document.errors.map((error) => [
          String(error.n),
          error.storyId,
          `${error.kind}: ${error.place === undefined ? "" : `${error.place}: `}${error.message}`
        ]),
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
    report.shots.map((shot) => [
      shot.storyId,
      shot.view || "default",
      shownFile(shot.file),
      shot.status === undefined ? "" : `not of the story: ${shot.status}`
    ]),
    {
      columns: [
        { header: "Story" },
        { header: "View", tone: "muted" },
        { header: "Picture" },
        { header: "Status" }
      ]
    },
    uncut(style)
  );

/**
 * A comparison with the baselines as a person reads it.
 *
 * @param report - the results.
 * @param shownFile - how a file is named.
 * @param style - the output's style.
 */
export const diffText = (
  report: StoryDiffReport,
  shownFile: (file: string) => string,
  style: OutputStyle
): string =>
  table(
    report.results.map((each) => [
      each.storyId,
      each.view || "default",
      each.status,
      each.status === "changed" ? `${each.percent.toFixed(2)} %` : "",
      each.diff === undefined ? "" : shownFile(each.diff)
    ]),
    {
      columns: [
        { header: "Story" },
        { header: "View", tone: "muted" },
        { header: "Status" },
        { header: "Changed" },
        { header: "Marked" }
      ]
    },
    uncut(style)
  );

/**
 * Tokens as a person reads them: one line each, how many there are when it is more than the list, and why when none.
 *
 * @param document - the answer.
 */
export const tokensText = (document: TokensDocument): string => {
  if (!document.isConfigured)
    return 'No tokens file, and none found in the application: name one in forgebook.config.ts (`tokens: ["tokens.json"]`) or on a source.';
  if (document.total === 0) return "No tokens here.";
  const lines = document.tokens.map((token) => tokenLine(token));
  const more = document.total - document.tokens.length;
  return [
    ...lines,
    ...(more > 0 ? [`… and ${more} more: narrow it with --category, or raise --limit.`] : []),
    ...tokenSourceLines(document.sources ?? [], document.notes ?? [])
  ].join("\n");
};

/** What tokens were read from, on one line, and what could not be, as a person reads them. */
const tokenSourceLines = (sources: readonly TokenSource[], notes: readonly string[]): string[] => {
  const read = sources.filter((source) => source.kind !== "tokens-file");
  return [
    ...(read.length === 0
      ? []
      : [
          `Read from: ${read.map(({ kind, file, tokens }) => `${file} (${kind}, ${tokens ?? 0})`).join(", ")}`
        ]),
    ...notes.map((note) => `Not read: ${note}`)
  ];
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
    ...(token.source === undefined ? [] : [`from ${token.source}`]),
    ...(token.description === undefined ? [] : [token.description])
  ].join("\n");

/**
 * A clash as a person reads it: which file's value stands, and which it replaced.
 *
 * @param clash - the clash.
 */
export const clashText = ({ name, mode, kept, replaced }: TokenClash): string =>
  `${name}${mode === undefined ? "" : ` (${mode})`}: ${kept} replaces ${replaced.join(", ")}`;

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
    ...(lines.length > 0
      ? lines
      : [document.skipped.length > 0 ? "Nothing to report in what was checked." : "Nothing to report."]),
    ...document.skipped,
    ...(document.advice ?? []).map(({ file, line, message }) => `${file}:${line}  ${message}`),
    ...(document.excused ?? []).map(
      ({ file, line, rule, reason }) => `${file}:${line}  ${rule} excused by a comment: ${reason}`
    ),
    ...tokenSourceLines(document.tokenSources ?? [], document.tokenNotes ?? [])
  ].join("\n");
};

/** A published component an agent cannot see, a line for each thing that hides it. */
const unseenLines = ({ file, reasons }: UnseenComponent): readonly string[] =>
  reasons.map(({ reason, fix }) => `${file}  agents cannot see it: ${reason}. Fix: ${fix}`);

/**
 * The published components an agent cannot see, what was not looked at, and how many were.
 *
 * @param document - the answer.
 */
export const visibilityText = (document: VisibilityDocument): string => {
  const scope = document.since === undefined ? "" : ` changed since ${document.since}`;
  const count = `${document.checked} published component file${document.checked === 1 ? "" : "s"}${scope}`;
  const ending =
    document.packages.length === 0 && document.skipped.length === 0
      ? "No package here publishes a component: nothing to hold to this."
      : `${count}, ${document.unseen.length} agents cannot see.`;
  return [...document.unseen.flatMap(unseenLines), ...document.skipped, ending].join("\n");
};

/**
 * What `verify` found, each with its fix, and the verdict in one line, last: what a person reads first at a prompt.
 *
 * @param document - the answer.
 * @param style - colours, glyphs and width.
 */
export const verifyText = (document: VerifyDocument, style: OutputStyle): string => {
  const uncovered = document.uiFiles.flatMap((each) =>
    each.coverage === "none"
      ? [
          `${each.file}  not verified: ${each.reason ?? ""}${each.fix === undefined ? "" : ` Fix: ${each.fix}`}`
        ]
      : []
  );
  const unseen = document.unseen.flatMap(unseenLines);
  const code = document.code.problems.map(
    (each) => `${each.file}${each.line === undefined ? "" : `:${each.line}`}  ${each.message}`
  );
  const notes = document.code.notes.map(
    (each) => `${each.file}${each.line === undefined ? "" : `:${each.line}`}  note: ${each.message}`
  );
  const advice = (document.code.advice ?? []).map((each) => `${each.file}:${each.line}  ${each.message}`);
  const results = [
    ...document.failures,
    ...document.notVerified.map((each) => ({ ...each, problems: [] }))
  ].map((each) => ({ ...each, frame: each.links?.frame ?? "" }));
  const stories = results.length === 0 ? [] : [checkText({ schema: 1, results }, style)];
  return [...uncovered, ...unseen, ...code, ...notes, ...advice, ...stories, document.summary].join("\n");
};

/**
 * The catalogue's plugins, one per line.
 *
 * @param document - the answer.
 */
export const pluginsText = (document: PluginsDocument): string => {
  if (document.plugins.length === 0)
    return "No plugins: list them in forgebook.config.ts (`plugins: [figma()]`).";
  return document.plugins
    .map((plugin) => {
      const parts = [
        ...plugin.tabs.map((tab) => `tab ${tab.id}`),
        ...plugin.switches.map((id) => `switch ${id}`),
        ...plugin.docBlocks.map((fence) => `docs block ${fence}`),
        ...(plugin.runsInFrames ? ["runs in frames"] : [])
      ];
      return `${plugin.id}: ${parts.join(", ")}`;
    })
    .join("\n");
};

/**
 * The docs pages as a table: one row per page, its id first (what `forgebook page` takes), then its title and how many
 * stories it shows.
 *
 * @param document - the pages document.
 * @param style - colours, glyphs and width.
 */
export const pagesText = (document: PagesDocument, style: OutputStyle): string => {
  // the written home comes first, as the page a reader meets first
  const pages = document.home === undefined ? document.pages : [document.home, ...document.pages];
  return pages.length === 0
    ? "No docs pages here."
    : table(
        pages.map((page) => [page.id, page.title, String(page.stories.length)]),
        {
          columns: [{ header: "Id" }, { header: "Page", tone: "muted" }, { header: "Stories", tone: "muted" }]
        },
        uncut(style)
      );
};

/**
 * One docs page as a person reads it: where it opens, then its Markdown.
 *
 * @param document - the page's document.
 */
export const pageText = (document: PageDocument): string =>
  [document.page.links.address, "", document.text].join("\n");

/**
 * What a search found as a person reads it: each result with its address, then what matched inside it.
 *
 * @param document - the search's document.
 */
export const searchText = (document: SearchDocument): string =>
  document.results.length === 0
    ? `Nothing in the catalogue holds "${document.query}".`
    : document.results
        .flatMap((result) => [
          `${result.name} (${result.place})${result.missed.length === 0 ? "" : `, missing: ${result.missed.join(", ")}`}`,
          `  ${result.address}`,
          ...result.hits.flatMap((hit) => [
            `  ${hit.kind}${hit.name === undefined ? "" : ` ${hit.name}`}: ${hit.text}`,
            `    ${hit.address}`
          ])
        ])
        .join("\n");

/**
 * The catalogue's switches, one per line, each with its values and what they bring with them.
 *
 * @param document - the answer.
 */
export const switchesText = (document: SwitchesDocument): string =>
  document.switches
    .map((each) => {
      const values = each.values.map(({ value, implies }) => {
        const implied = Object.entries(implies ?? {}).map(([id, other]) => `${id}=${other}`);
        return implied.length === 0 ? value : `${value} (implies ${implied.join(", ")})`;
      });
      return `${each.id} (${each.control}): ${values.join(", ")}`;
    })
    .join("\n");
