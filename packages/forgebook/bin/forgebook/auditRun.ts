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

import {
  type AuditSite,
  type AuditSystem,
  type AuditValue,
  type ValueAudit,
  valueAudit,
  valueSites
} from "../../src/vite/appAudit.ts";
import { readAppTokens } from "../../src/vite/appTokens.ts";
import { projectComponents } from "../../src/vite/componentScan.ts";
import { type LookAlike, lookAlikes } from "../../src/vite/lookAlikes.ts";
import { projectFiles, UI_PATTERNS } from "../../src/vite/projectFiles.ts";

/** The next step a report proposes. */
export type AuditAction = {
  /** What kind of step. */
  readonly kind: "use-token" | "name-value" | "merge-values" | "merge-components";
  /** What to do, in a sentence. */
  readonly message: string;
  /** How many places it touches. */
  readonly count: number;
  /** The command that lists them, when one does: to read, since quoting differs between shells. */
  readonly command?: string;
  /** The same command as its words, to run without a shell. */
  readonly args?: readonly string[];
  /** The components it is about, with where they are. */
  readonly members?: LookAlike["members"];
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
  const files = projectFiles(dir, notes);
  const values = valueAudit(files, tokens, top);
  const components = projectComponents(files);
  const alike = lookAlikes(components);
  return {
    schema: 1,
    system: {
      tokens: tokens.length,
      own: tokens.filter((token) => token.origin?.kind !== "tailwind-default").length,
      sources,
      notes
    },
    ...values,
    components: { count: components.length, lookAlikes: alike },
    actions: [...valueActions(values, folder), ...componentActions(alike)]
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
    "Next:",
    ...actions.slice(0, 10).map(({ message }) => `  ${message}`),
    ...system.notes.map((note) => `Not read: ${note}`)
  ].join("\n");
};
