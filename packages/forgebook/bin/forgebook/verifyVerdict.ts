/**
 * What `verify` concludes from the change, its code check and its stories' run: the document, and the one line that says
 * it.
 *
 * @remarks
 * Pure, so the rule the whole command exists for can be read and tested apart: a change is verified only if every changed
 * UI file reached a story that actually ran, and what was not checked is never counted as passed. A story that was
 * listed and did not run covers nothing, so the coverage is read from the results and not from the graph, and a story
 * whose frame gave up on what it loads did not run: no check saw it in its final state. A changed file
 * that no one sees does not fail, whatever it reaches; what `check-code` finds in it (a turned-off check, a deleted test)
 * is said as a note. A published component the change touches that an agent cannot find or read (`unseen`,
 * `agentVisibility.ts`) leaves it not verified: what is checked but cannot be found gets rebuilt. An empty change passes only against a commit someone named: with none, the work may simply be
 * committed where this cannot look (a shallow clone, a default branch it does not know).
 *
 * @module
 */
import { shellWord } from "../../src/shellWord.ts";
import type { StoryCheckReport, StoryCheckResult } from "../../src/storyCheck.ts";
import type {
  ChangedStoriesDocument,
  ChangedUiFile,
  CheckedCodeDocument,
  VerifiedUiFile,
  VerifyDocument,
  VerifyFailure,
  VerifyNotVerified,
  VerifyVerdict,
  VisibilityDocument
} from "../../src/vite/agent.types.ts";
import { type BaseRun, splitByBase } from "./verifyBase.ts";

/** A sheet, whose fix is not a story of its own. */
const SHEET_FILE = /\.(?:css|scss|sass|less)$/;

/** A story file, whose stories have to load. */
const STORY_FILE = /\.stories\.[^/]+$/;

/** A template, which has no props to write a story from. */
const TEMPLATE_FILE = /\.html$/;

/** How many stories an answer lists. */
const STORIES_LISTED = 20;

/** What to do about a file no story reaches. */
const fixOf = (file: ChangedUiFile): string => {
  if (STORY_FILE.test(file.file))
    return `npx forgebook stories --json says why it does not load; add it to the catalogue's stories if it is not listed`;
  if (SHEET_FILE.test(file.file) || TEMPLATE_FILE.test(file.file))
    return "use it from a component that has stories, or import the sheet in forgebook.preview.ts";
  return `npx forgebook new ${shellWord(file.path)}`;
};

/** A UI file, by the stories that ran. */
const verifiedFile = (
  file: ChangedUiFile,
  ran: ReadonlySet<string>,
  notRun: string | undefined
): VerifiedUiFile => {
  const stories = file.stories.filter((id) => ran.has(id)).length;
  if (stories > 0) return { file: file.file, coverage: file.coverage, stories };
  return {
    file: file.file,
    coverage: "none",
    stories: 0,
    ...(file.stories.length > 0
      ? {
          reason: `its stories did not run: ${notRun ?? "the check left them out, or never saw them in their final state"}`
        }
      : { reason: "no story reaches it.", fix: fixOf(file) })
  };
};

/** A count with its noun. */
const counted = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

/** What a line's first part says of the UI files. */
const coverageWords = (files: readonly VerifiedUiFile[]): string => {
  const covered = files.filter((each) => each.coverage !== "none").length;
  const through = files.filter((each) => each.coverage === "through").length;
  const parts = through === 0 ? "" : ` (${through} through another component's)`;
  return `${counted(files.length, "changed UI file")}, ${covered} with stories${parts}`;
};

/** The verdict, the worst that holds. */
const verdictOf = (
  files: readonly VerifiedUiFile[],
  problems: number,
  skipped: readonly string[],
  catalogueProblems: readonly string[],
  isBlind: boolean,
  notVerified: number
): VerifyVerdict => {
  if (problems > 0) return "failed";
  if (notVerified > 0 || files.some((each) => each.coverage === "none")) return "not-verified";
  if (isBlind || catalogueProblems.length > 0) return "not-verified";
  if (files.length === 0) return "nothing-to-verify";
  return skipped.length > 0 ? "partly-verified" : "verified";
};

/** A changed file the stories do reach, whose values were compared with nothing: outside the catalogue's folder. */
const notComparedLine = ({ changed, code }: VerifyFindings): readonly string[] => {
  const compared = new Set(code.notCompared);
  return changed.uiFiles.some((file) => compared.has(file.file))
    ? ["colours and sizes of a file outside this catalogue's folder not checked"]
    : [];
};

/** What was not checked, in the words a person reads. */
const skippedOf = (input: VerifyFindings, notRun: string | undefined): readonly string[] => {
  const { changed, code, report, isQuick, isSinceNamed, since } = input;
  const hasUi = changed.uiFiles.length > 0;
  const hasStories = changed.stories.length > 0;
  const notAwaited = new Set(
    (report?.results ?? []).filter((each) => each.isNotAwaited === true).map((each) => each.storyId)
  );
  return [
    // a story may mean it, and a preview that sets it for all of them turns the wait off: either way, said
    ...(notAwaited.size === 0
      ? []
      : [
          `${notAwaited.size === 1 ? "1 story" : `${notAwaited.size} stories`} checked without waiting for what it loads: parameters.suspense.expected`
        ]),
    // nothing a token names was touched when no UI file changed, so its absence said nothing about the change
    ...(hasUi ? code.skipped : []),
    ...notComparedLine(input),
    ...(report?.a11y === "off" && hasStories
      ? ["accessibility not checked: the catalogue sets a11y: false"]
      : []),
    ...(isQuick && hasStories ? ["only the default view checked: --quick"] : []),
    ...(!hasUi && hasStories && notRun !== undefined ? [`stories not run: ${notRun}`] : []),
    ...(!hasUi ? changed.problems.filter((problem) => !changed.unread?.includes(problem)) : []),
    // committed work on a branch would not show: compared with the commit itself, only what is not committed does
    ...(!isSinceNamed && since === "HEAD" && changed.files.length > 0
      ? ["committed work not compared: no default branch found here, give --since"]
      : []),
    ...(changed.outside.length > 0
      ? [
          `${counted(changed.outside.length, "UI file")} of another catalogue not checked: ${changed.outside.join(", ")}`
        ]
      : [])
  ];
};

/** What `verifyDocument` reads. */
export type VerifyFindings = {
  /** What the change is measured from, as named. */
  readonly since: string;
  /** The commit that is. */
  readonly base: string;
  /** The catalogue's answer on the change. */
  readonly changed: ChangedStoriesDocument;
  /** The catalogue's answer on what the change adds. */
  readonly code: CheckedCodeDocument;
  /** The catalogue's answer on the published components the change touches. */
  readonly visibility: VisibilityDocument;
  /** The stories' report; none when none ran. */
  readonly report: StoryCheckReport | undefined;
  /** Why they did not run, when they were to. */
  readonly notRun: string | undefined;
  /** Only the default view was asked for. */
  readonly isQuick: boolean;
  /** Whether a commit was named: with none, an empty change may only mean the work is where this cannot look. */
  readonly isSinceNamed: boolean;
  /** The failing stories run again on the base, when they were: what the base had too is not the change's. */
  readonly baseRun?: { readonly base: string; readonly run: BaseRun };
  /**
   * What is wrong with the catalogue's configuration: the answer is not verified when the change has a UI file, whatever
   * else it found, and only says it when the change has none.
   */
  readonly configProblems?: readonly string[];
};

/** A base run that found no story of the change's: every problem is the change's, as with a base that has none. */
const NO_STORY = /^No story or component /;

/**
 * The report on the change with the problems the base had too taken out, and those problems; the report as it is when
 * no base ran or it could not, with why.
 */
const comparedWithBase = (
  report: StoryCheckReport | undefined,
  baseRun: VerifyFindings["baseRun"]
): {
  readonly report: StoryCheckReport | undefined;
  readonly existing: readonly StoryCheckResult[];
  readonly isCompared: boolean;
  readonly unseen: number;
  readonly notCompared?: string;
} => {
  if (report === undefined || baseRun === undefined)
    return { report, existing: [], isCompared: false, unseen: 0 };
  const { run } = baseRun;
  if (typeof run === "string" && !NO_STORY.test(run))
    return {
      report,
      existing: [],
      isCompared: false,
      unseen: 0,
      notCompared: `not compared with ${baseRun.base.slice(0, 12)}: ${run}`
    };
  if (typeof run === "string") return { report, existing: [], isCompared: true, unseen: 0 };
  return { ...splitByBase(report, run.report, [run.root, run.folder]), isCompared: true };
};

/** What a line says of a change with no UI file. */
const noUiWords = ({
  files,
  ran,
  problems,
  notVerified,
  unseen
}: Omit<VerifyDocument, "summary" | "schema">): string => {
  const stories = ran === 0 ? "" : `, ${ran} checks of the stories they reach`;
  const found = [
    ...(problems === 0 ? [] : [counted(problems, "problem")]),
    ...(notVerified.length === 0 ? [] : [`${notVerified.length} not verified`]),
    ...(unseen.length === 0 ? [] : [`${counted(unseen.length, "published component")} agents cannot see`])
  ].join(", ");
  return `No changed UI file (${counted(files.length, "other file")}${stories})${found === "" ? "" : `: ${found}`}`;
};

/** What a line says after the coverage. */
const outcomeWords = (
  {
    verdict,
    uiFiles,
    problems,
    variants,
    ran,
    notVerified: unseen,
    outdated,
    unseen: cannotBeSeen
  }: Omit<VerifyDocument, "summary" | "schema">,
  catalogueProblems: readonly string[]
): string => {
  const notVerified =
    unseen.length > 0 ||
    cannotBeSeen.length > 0 ||
    uiFiles.some((each) => each.coverage === "none") ||
    catalogueProblems.length > 0;
  const where = variants === "all" ? "in every variant" : "in the default view";
  return [
    ...(notVerified ? ["not verified"] : []),
    ...(unseen.length > 0 ? [`${unseen.length} not seen in its final state: the frame gave up`] : []),
    ...(cannotBeSeen.length > 0
      ? [`${counted(cannotBeSeen.length, "published component")} agents cannot see`]
      : []),
    ...(problems > 0 ? [counted(problems, "problem")] : []),
    ...(outdated === undefined ? [] : [`${counted(outdated.length, "story file")} written for other props`]),
    ...(verdict === "verified" || verdict === "partly-verified"
      ? [`verified ${where} (${counted(ran, "check")})`]
      : [])
  ].join(", ");
};

/**
 * The verdict's line.
 *
 * @param document - the document so far.
 * @param catalogueProblems - what the catalogue could not read.
 */
const summaryOf = (
  document: Omit<VerifyDocument, "summary" | "schema">,
  catalogueProblems: readonly string[]
): string => {
  const { verdict, uiFiles, files, since, code, skipped } = document;
  const isBlind = files.length === 0 && catalogueProblems.length === 0;
  const notes = code.notes.length === 0 ? [] : [`${counted(code.notes.length, "note")} from check-code`];
  const said = [...skipped, ...notes];
  const tail = said.length === 0 ? "" : `; ${said.join("; ")}`;
  if (files.length === 0) {
    const notVerified = isBlind
      ? "not verified. If your work is committed, give --since <ref>"
      : "not verified";
    const ending = verdict === "not-verified" ? notVerified : "nothing to verify";
    return `Nothing changed since ${since}: ${ending}${tail}`;
  }
  if (uiFiles.length === 0) {
    const ending = catalogueProblems.length === 0 ? "" : ": not verified";
    return `${noUiWords(document)}${ending}${tail}`;
  }
  return `${coverageWords(uiFiles)}: ${outcomeWords(document, catalogueProblems)}${tail}`;
};

/**
 * The pairs that found a problem, each with the links that open its story.
 *
 * @param results - the pairs that ran.
 * @param links - the links of the change's stories, by id.
 */
const failuresOf = (
  results: readonly StoryCheckResult[],
  links: ReadonlyMap<string, VerifyFailure["links"]>
): VerifyFailure[] =>
  results
    .filter((result) => result.problems.length > 0)
    .map(({ storyId, view, problems: found }): VerifyFailure => {
      const storyLinks = links.get(storyId);
      return { storyId, view, problems: found, ...(storyLinks === undefined ? {} : { links: storyLinks }) };
    });

/** What the comparison with the base leaves unchecked: a base that could not run, stories it never saw. */
const baseSkips = (compared: ReturnType<typeof comparedWithBase>): string[] => [
  ...(compared.notCompared === undefined
    ? []
    : [`${compared.notCompared}; every problem the stories have is counted`]),
  ...(compared.unseen === 0
    ? []
    : [
        `${counted(compared.unseen, "story")} not seen on the base in its final state: every problem of it counted`
      ])
];

/**
 * The answer to whether a change is verified.
 *
 * @param input - what was found.
 */
export const verifyDocument = (input: VerifyFindings): VerifyDocument => {
  const { since, base, changed, code, visibility, notRun, isQuick, isSinceNamed } = input;
  const compared = comparedWithBase(input.report, input.baseRun);
  const { report } = compared;
  const results = report?.results ?? [];
  // a story not seen in a view is left out of what ran there; seen in another it still covers its file, and the verdict
  // says not verified from `notVerified` either way
  const seenResults = results.filter((result) => result.notVerified === undefined);
  const ran = new Set(seenResults.map((result) => result.storyId));
  const uiFiles = changed.uiFiles.map((file) => verifiedFile(file, ran, notRun));
  const links = new Map(changed.stories.map((story) => [story.id, story.links]));
  const failures = failuresOf(results, links);
  const notVerified = results.flatMap(({ storyId, view, notVerified: reason }): VerifyNotVerified[] => {
    if (reason === undefined) return [];
    const storyLinks = links.get(storyId);
    return [
      { storyId, view, notVerified: reason, ...(storyLinks === undefined ? {} : { links: storyLinks }) }
    ];
  });
  // a change no one sees does not fail; what the code check found in it is still said
  const seen = new Set(changed.uiFiles.map((file) => file.file));
  const codeProblems = code.problems.filter((problem) => seen.has(problem.file));
  const outside = new Set(changed.outside);
  const notes = code.problems.filter((problem) => !seen.has(problem.file) && !outside.has(problem.file));
  // stories written for props the component no longer has pass a check they no longer mean: each is a problem
  const outdated = changed.outdated ?? [];
  const problems = failures.reduce(
    (sum, each) => sum + each.problems.length,
    codeProblems.length + outdated.length
  );
  const existingProblems = compared.existing.reduce((sum, each) => sum + each.problems.length, 0);
  const hasUiFiles = changed.uiFiles.length > 0;
  // a change with no UI file is not the gate's business: a configuration problem, a story pattern that matches nothing
  // in a catalogue with no story yet, is said and does not stop it; a story file the pattern misses is a UI file itself
  const configProblems = input.configProblems ?? [];
  const skipped = [
    ...skippedOf(input, notRun),
    ...baseSkips(compared),
    ...(hasUiFiles ? [] : configProblems)
  ];
  // a story file that cannot be read may be the change, whatever else changed
  const catalogueProblems = hasUiFiles
    ? [...configProblems, ...changed.problems]
    : [...(changed.unread ?? [])];
  const isBlind = changed.files.length === 0 && !isSinceNamed;
  const { unseen } = visibility;
  const verdict = verdictOf(
    uiFiles,
    problems,
    [...skipped, ...visibility.skipped],
    catalogueProblems,
    isBlind,
    notVerified.length + unseen.length
  );
  const allSkipped = [...skipped, ...catalogueProblems, ...visibility.skipped];
  const variants: VerifyDocument["variants"] = isQuick ? "default" : "all";
  const body = {
    since,
    base,
    variants,
    files: changed.files,
    uiFiles,
    storyCount: changed.stories.length,
    stories: changed.stories.slice(0, STORIES_LISTED),
    ran: seenResults.length,
    failures,
    notVerified,
    code: {
      checked: code.checked,
      problems: codeProblems,
      notes,
      ...(code.tokenSources === undefined ? {} : { tokenSources: code.tokenSources }),
      ...(code.tokenNotes === undefined ? {} : { tokenNotes: code.tokenNotes }),
      ...(code.excused === undefined ? {} : { excused: code.excused }),
      ...(code.advice === undefined ? {} : { advice: code.advice })
    },
    ...(outdated.length === 0 ? {} : { outdated }),
    problems,
    ...(compared.isCompared
      ? { existing: { problems: existingProblems, failures: failuresOf(compared.existing, links) } }
      : {}),
    unseen
  };
  // problems the base had too are not a check left undone: said in the line, never in skipped
  const old =
    existingProblems === 0
      ? ""
      : `; ${counted(existingProblems, "problem")} the stories had before the change not counted (existing; --all-problems counts them)`;
  const summary = `${summaryOf({ ...body, verdict, skipped: allSkipped }, catalogueProblems)}${old}`;
  return { schema: 2, verdict, summary, skipped: allSkipped, ...body };
};
