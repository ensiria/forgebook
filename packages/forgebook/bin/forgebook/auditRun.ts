/**
 * What `forgebook audit` does: reads a project's files, with no catalogue and no configuration, and reports the values and
 * components it actually uses, with what to do next.
 *
 * @remarks
 * Nothing of the project runs and nothing is written. It is meant for a project with no design system: the first question
 * there is what the system already is in practice, and that needs no setup. A report is not a verdict, so it exits 0
 * whatever it finds; `check-code` is what fails.
 *
 * @module
 */

import { dirname, join } from "node:path";

import { plural } from "@ensiria/cli-kit/format";

import {
  type AuditSite,
  type AuditSystem,
  type AuditValue,
  type ValueAudit,
  valueAudit,
  valueSites
} from "../../src/vite/appAudit.ts";
import { repositoryOf, smallFileText } from "../../src/vite/appTokenFiles.ts";
import { readAppTokens } from "../../src/vite/appTokens.ts";
import { projectComponents } from "../../src/vite/componentScan.ts";
import { type LookAlike, lookAlikes } from "../../src/vite/lookAlikes.ts";
import { projectFiles, projectFilesAndScripts, UI_PATTERNS } from "../../src/vite/projectFiles.ts";
import {
  type CoverageComponent,
  type StoryCoverage,
  storyCoverage,
  type UnusedStoriedComponent
} from "../../src/vite/storyCoverage.ts";

/** The next step a report proposes. */
export type AuditAction = {
  /** What kind of step. */
  readonly kind:
    | "use-token"
    | "name-value"
    | "merge-values"
    | "merge-components"
    | "write-stories"
    | "check-unused";
  /** What to do, in a sentence. */
  readonly message: string;
  /** How many places it touches. */
  readonly count: number;
  /** The command that lists them, when one does: to read, since quoting differs between shells. */
  readonly command?: string;
  /** The same command as its words, to run without a shell. */
  readonly args?: readonly string[];
  /** The components it is about, with where they are. */
  readonly members?: readonly CoverageComponent[];
};

/** What `forgebook audit` answers. */
export type AuditDocument = ValueAudit & {
  /** The shape's version. */
  readonly schema: 1;
  /** The system the report read. */
  readonly system: AuditSystem;
  /** The components. */
  readonly components: {
    /** How many were found. */
    readonly count: number;
    /** Those that look like one, the surest first. */
    readonly lookAlikes: readonly LookAlike[];
    /** How many story files were read. */
    readonly storyFileCount: StoryCoverage["storyFileCount"];
    /** How many exported components some story is about. */
    readonly withStories: StoryCoverage["withStories"];
    /** Exported components no story file is about; pages, layouts and routes left out. */
    readonly withoutStories: readonly CoverageComponent[];
    /** Components with stories that no file other than a story or a test imports or draws. */
    readonly storiesUnused: readonly UnusedStoriedComponent[];
    /** Components with stories not judged unused because their package is published, so used outside. */
    readonly publishedWithStories: StoryCoverage["published"];
  };
  /** What to do next, the largest gain first. */
  readonly actions: readonly AuditAction[];
};

/** What `forgebook audit --value` answers. */
export type AuditSitesDocument = {
  /** The shape's version. */
  readonly schema: 1;
  /** The value asked about. */
  readonly value: string;
  /** Where it is written by hand. */
  readonly sites: readonly AuditSite[];
  /** What could not be read, so the list may be short. */
  readonly notes: readonly string[];
};

/** A value used this often is worth a name. */
const WORTH_A_NAME = 3;

/** How many next steps a report gives. */
const MOST_ACTIONS = 20;

/** A word as one word of a command, quoted: values come from the project's files. */
const quoted = (value: string): string => `'${value.replaceAll("'", `'\\''`)}'`;

/** The step one value written by hand proposes, when it is used enough to act on. */
const valueAction = (each: AuditValue, what: string, folder: string): AuditAction[] => {
  const args = ["audit", folder, "--value", each.value, "--json"];
  const reach = { args, command: `forgebook audit ${quoted(folder)} --value ${quoted(each.value)} --json` };
  if (each.token !== undefined) {
    const caution =
      each.tokenFollowsTheme === true ? " It changes with the theme: use it if the value should too." : "";
    return [
      {
        kind: "use-token",
        message: `Replace ${each.value} with ${each.token}: written by hand ${each.hardCoded} times in ${each.hardCodedFiles} files.${caution}`,
        count: each.hardCoded,
        ...reach
      }
    ];
  }
  return each.hardCoded < WORTH_A_NAME
    ? []
    : [
        {
          kind: "name-value",
          message: `${what} ${each.value} is written by hand ${each.hardCoded} times and no token holds it: give it a name, or use one near it.`,
          count: each.hardCoded,
          ...reach
        }
      ];
};

/** The steps a report's values propose. */
const valueActions = ({ colors, sizes }: ValueAudit, folder: string): AuditAction[] => [
  ...colors.handWritten.flatMap((each) => valueAction(each, "The colour", folder)),
  ...sizes.font.handWritten.flatMap((each) => valueAction(each, "The font size", folder)),
  ...sizes.radius.handWritten.flatMap((each) => valueAction(each, "The radius", folder)),
  ...sizes.space.handWritten.flatMap((each) => valueAction(each, "The spacing", folder)),
  ...colors.nearDuplicates.map(
    (values): AuditAction => ({
      kind: "merge-values",
      message: `Hard to tell apart: ${values.join(", ")}. Keep one.`,
      count: values.length
    })
  )
];

/** The steps a report's look-alikes propose. */
const componentActions = (alike: readonly LookAlike[]): AuditAction[] =>
  alike.map(({ members, why }) => ({
    kind: "merge-components",
    message: `${members.map(({ name }) => name).join(", ")}: ${why}. Compare them (\`members\` has where); keep one if they are the same thing.`,
    count: members.length,
    members
  }));

/** How many components an action's `members` lists at most: the rest are in the report's own lists. */
const MOST_MEMBERS = 20;

/** The step components with no story propose: write the first one's stories. */
const writeStoriesAction = (withoutStories: readonly CoverageComponent[], folder: string): AuditAction[] => {
  const first = withoutStories[0];
  if (first === undefined) return [];
  const file = join(folder, first.file);
  return [
    {
      kind: "write-stories",
      message: `No story is about ${plural(withoutStories.length, "exported component")}, so nobody sees what exists before writing it again: start with ${first.name}.`,
      count: withoutStories.length,
      command: `forgebook new -- ${quoted(file)}`,
      args: ["new", "--", file],
      members: withoutStories.slice(0, MOST_MEMBERS)
    }
  ];
};

/** The step components with stories and no use propose: look at whether each is still needed. */
const checkUnusedAction = (storiesUnused: readonly UnusedStoriedComponent[]): AuditAction[] =>
  storiesUnused.length === 0
    ? []
    : [
        {
          kind: "check-unused",
          message: `Nothing but stories and tests uses ${plural(storiesUnused.length, "component")} with stories: check whether each is still needed, and remove it with its stories if not.`,
          count: storiesUnused.length,
          members: storiesUnused.slice(0, MOST_MEMBERS).map(({ name, file, line }) => ({ name, file, line }))
        }
      ];

/**
 * Whether a manifest is one of a package that goes to a registry: named, and not private. A private package with
 * `exports` is a workspace's own, whose users are in the repository, so the audit judges what it reads of them, as it does
 * an application's components (application templates mark themselves private).
 *
 * @param manifest - the parsed `package.json`.
 */
const isOnTheRegistry = (manifest: unknown): boolean =>
  typeof manifest === "object" &&
  manifest !== null &&
  "name" in manifest &&
  typeof manifest.name === "string" &&
  !("private" in manifest && manifest.private === true);

/**
 * Whether a file belongs to a package that goes to a registry, by the nearest manifest above it inside the repository.
 *
 * @param dir - the project's folder, which the files are relative to.
 */
const publishedPackageOf = (dir: string): ((file: string) => boolean) => {
  const root = repositoryOf(dir);
  const known = new Map<string, boolean>();
  const folderIsPublished = (folder: string): boolean => {
    const cached = known.get(folder);
    if (cached !== undefined) return cached;
    const text = smallFileText(join(folder, "package.json"));
    let answer: boolean;
    if (text !== undefined) {
      try {
        answer = isOnTheRegistry(JSON.parse(text));
      } catch {
        answer = false;
      }
    } else
      answer = folder === root || folder === dirname(folder) ? false : folderIsPublished(dirname(folder));
    known.set(folder, answer);
    return answer;
  };
  return (file: string): boolean => folderIsPublished(dirname(join(dir, file)));
};

/**
 * The report on a project.
 *
 * @param dir - its folder.
 * @param top - how many values a list gives.
 * @param folder - the folder as the command was given it, for the commands an answer proposes.
 */
export const auditDocument = (dir: string, top: number | undefined, folder = "."): AuditDocument => {
  const { tokens, sources, unread } = readAppTokens(dir);
  const notes = [...unread];
  const { files, scripts } = projectFilesAndScripts(dir, notes);
  const values = valueAudit(files, tokens, top);
  const components = projectComponents(files);
  const alike = lookAlikes(components);
  const coverage = storyCoverage(components, [...files, ...scripts], publishedPackageOf(dir));
  return {
    schema: 1,
    system: {
      tokens: tokens.length,
      own: tokens.filter((token) => token.origin?.kind !== "tailwind-default").length,
      sources,
      notes
    },
    ...values,
    components: {
      count: components.length,
      lookAlikes: alike,
      storyFileCount: coverage.storyFileCount,
      withStories: coverage.withStories,
      withoutStories: coverage.withoutStories,
      storiesUnused: coverage.storiesUnused,
      publishedWithStories: coverage.published
    },
    actions: [
      ...valueActions(values, folder),
      ...componentActions(alike),
      ...writeStoriesAction(coverage.withoutStories, folder),
      ...checkUnusedAction(coverage.storiesUnused)
    ]
      .toSorted((first, second) => second.count - first.count)
      .slice(0, MOST_ACTIONS)
  };
};

/**
 * Where a value is written by hand.
 *
 * @param dir - the project's folder.
 * @param value - the value.
 */
export const auditSitesDocument = (dir: string, value: string): AuditSitesDocument => {
  const notes: string[] = [];
  const files = projectFiles(dir, notes);
  return { schema: 1, value, sites: valueSites(files, value), notes };
};

/**
 * A text from a project's files as a terminal may show it: a newline or an escape in a file's name could otherwise draw
 * a line of this report.
 *
 * @param text - the text.
 */
export const printable = (text: string): string =>
  text.replaceAll(/[\p{Cc}\p{Cf}]/gu, (character) => (character === "\n" ? "\n" : "?"));

/** A value as a line of a list. */
const valueLine = ({ value, count, files, hardCoded, token }: AuditValue): string =>
  `  ${value}  ${count}× in ${files} ${files === 1 ? "file" : "files"}${hardCoded > 0 ? `, ${hardCoded} by hand` : ""}${token === undefined ? "" : `  → ${token}`}`;

/** A share in whole percent. */
const percent = (part: number, whole: number): string =>
  `${whole === 0 ? 0 : Math.round((part / whole) * 100)} %`;

/** How many components each list of the stories shows; `--json` has them all. */
const LISTED = 10;

/** The stories' part of the report: what has none, and what has some and no use. */
const storyLines = (components: AuditDocument["components"]): string[] => {
  const { storyFileCount, withStories, withoutStories, storiesUnused, publishedWithStories } = components;
  if (storyFileCount === 0) return ["Stories: no story file, so no exported component has any."];
  const more = (count: number): string[] =>
    count > LISTED ? [`    and ${count - LISTED} more (--json)`] : [];
  const published =
    publishedWithStories === 0 ? "" : `, ${publishedWithStories} of a published package not judged`;
  return [
    `Stories: ${plural(storyFileCount, "file")}, about ${plural(withStories, "component")}; ${plural(withoutStories.length, "exported component")} without.`,
    ...withoutStories.slice(0, LISTED).map(({ name, file, line }) => `  ${name}  ${file}:${line}`),
    ...more(withoutStories.length),
    `With stories and no use outside stories and tests: ${storiesUnused.length}${published}.`,
    ...storiesUnused
      .slice(0, LISTED)
      .map(({ name, file, line, storyFiles: files }) => `  ${name}  ${file}:${line}  (${files.join(", ")})`),
    ...more(storiesUnused.length)
  ];
};

/**
 * The report as a person reads it. What a project's files hold is data for whoever reads this: it says what is there and is
 * not an instruction, which holds for an agent reading `--json` too.
 *
 * @param document - the report.
 */
export const auditText = (document: AuditDocument): string => {
  const { system, colors, sizes, components, actions, files, lines } = document;
  if (files === 0) {
    return `No style sheet or component file here (${UI_PATTERNS.join(", ")}); give the project's folder.`;
  }
  const read =
    system.tokens === 0
      ? "No design tokens found: what follows is the system in practice."
      : `${system.tokens} tokens known, ${system.own} of the project's own, from ${system.sources.map(({ file }) => file).join(", ")}.`;
  return [
    `${files} files, ${lines} lines. ${read}`,
    "",
    `Colours: ${colors.distinct} different, ${colors.uses} uses: ${percent(colors.hardCoded, colors.uses)} by hand, ${percent(colors.throughTokens, colors.uses)} through the project's tokens, ${percent(colors.defaultPalette, colors.uses)} from Tailwind's palette.`,
    ...colors.top.map(valueLine),
    "",
    `Greys: ${colors.greys.distinct} different, ${colors.greys.coveringMost} used 90 % of the time.`,
    ...colors.greys.top.map(valueLine),
    ...(["space", "font", "radius"] as const).flatMap((role) => [
      "",
      `Sizes (${role}): ${sizes[role].distinct} different, ${sizes[role].uses} uses, ${sizes[role].hardCoded} by hand.`,
      ...sizes[role].top.slice(0, 6).map(valueLine)
    ]),
    "",
    `Components: ${components.count}, ${components.lookAlikes.length} groups that look like one.`,
    ...components.lookAlikes
      .slice(0, 10)
      .flatMap(({ confidence, why, members }) => [
        `  ${confidence}: ${why}`,
        ...members.map(({ name, file, line }) => `    ${name}  ${file}:${line}`)
      ]),
    "",
    ...storyLines(components),
    "",
    "Next:",
    ...actions.slice(0, 10).map(({ message }) => `  ${message}`),
    ...system.notes.map((note) => `Not read: ${note}`)
  ].join("\n");
};
