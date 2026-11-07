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
 * is said as a note. An empty change passes only against a commit someone named: with none, the work may simply be
 * committed where this cannot look (a shallow clone, a default branch it does not know).
 *
 * @module
 */
import type { StoryCheckReport } from "../../src/storyCheck.ts";
import type {
  ChangedStoriesDocument,
  ChangedUiFile,
  CheckedCodeDocument,
  VerifiedUiFile,
  VerifyDocument,
  VerifyFailure,
  VerifyNotVerified,
  VerifyVerdict
} from "../../src/vite/agent.types.ts";

/** A sheet, whose fix is not a story of its own. */
const SHEET_FILE = /\.(?:css|scss|sass|less)$/;

/** A story file, whose stories have to load. */
const STORY_FILE = /\.stories\.[^/]+$/;

/** A template, which has no props to write a story from. */
const TEMPLATE_FILE = /\.html$/;

/** How many stories an answer lists. */
const STORIES_LISTED = 20;

/**
 * A file's name as one word of a command an agent will run: a name comes from a branch that may not be trusted, and
 * `$(…)` in it must stay text.
 */
const shellWord = (path: string): string => {
  const named = path.startsWith("-") ? `./${path}` : path;
  return /^[\w./@+-]+$/.test(named) ? named : `'${named.replaceAll("'", `'\\''`)}'`;
};

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
  /** The stories' report; none when none ran. */
  readonly report: StoryCheckReport | undefined;
  /** Why they did not run, when they were to. */
  readonly notRun: string | undefined;
  /** Only the default view was asked for. */
  readonly isQuick: boolean;
  /** Whether a commit was named: with none, an empty change may only mean the work is where this cannot look. */
  readonly isSinceNamed: boolean;
};

/** What a line says of a change with no UI file. */
const noUiWords = ({
  files,
  ran,
  problems,
  notVerified
}: Omit<VerifyDocument, "summary" | "schema">): string => {
  const stories = ran === 0 ? "" : `, ${ran} checks of the stories they reach`;
  const found = [
    ...(problems === 0 ? [] : [counted(problems, "problem")]),
    ...(notVerified.length === 0 ? [] : [`${notVerified.length} not verified`])
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
    notVerified: unseen
  }: Omit<VerifyDocument, "summary" | "schema">,
  catalogueProblems: readonly string[]
): string => {
  const notVerified =
    unseen.length > 0 || uiFiles.some((each) => each.coverage === "none") || catalogueProblems.length > 0;
  const where = variants === "all" ? "in every variant" : "in the default view";
  return [
    ...(notVerified ? ["not verified"] : []),
    ...(unseen.length > 0 ? [`${unseen.length} not seen in its final state: the frame gave up`] : []),
    ...(problems > 0 ? [counted(problems, "problem")] : []),
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
  const notes = code.notes.length === 0 ? [] : [`${counted(code.notes.length, "note")} from check-code`];
  const said = [...skipped, ...notes];
  const tail = said.length === 0 ? "" : `; ${said.join("; ")}`;
  if (files.length === 0) {
    const ending =
      verdict === "not-verified"
        ? "not verified. If your work is committed, give --since <ref>"
        : "nothing to verify";
    return `Nothing changed since ${since}: ${ending}${tail}`;
  }
  if (uiFiles.length === 0) {
    const ending = catalogueProblems.length === 0 ? "" : ": not verified";
    return `${noUiWords(document)}${ending}${tail}`;
  }
  return `${coverageWords(uiFiles)}: ${outcomeWords(document, catalogueProblems)}${tail}`;
};

/**
 * The answer to whether a change is verified.
 *
 * @param input - what was found.
 */
export const verifyDocument = (input: VerifyFindings): VerifyDocument => {
  const { since, base, changed, code, report, notRun, isQuick, isSinceNamed } = input;
  const results = report?.results ?? [];
  // a story not seen in a view is left out of what ran there; seen in another it still covers its file, and the verdict
  // says not verified from `notVerified` either way
  const seenResults = results.filter((result) => result.notVerified === undefined);
  const ran = new Set(seenResults.map((result) => result.storyId));
  const uiFiles = changed.uiFiles.map((file) => verifiedFile(file, ran, notRun));
  const links = new Map(changed.stories.map((story) => [story.id, story.links]));
  const failures = results
    .filter((result) => result.problems.length > 0)
    .map(({ storyId, view, problems: found }): VerifyFailure => {
      const storyLinks = links.get(storyId);
      return { storyId, view, problems: found, ...(storyLinks === undefined ? {} : { links: storyLinks }) };
    });
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
  const problems = failures.reduce((sum, each) => sum + each.problems.length, codeProblems.length);
  const skipped = skippedOf(input, notRun);
  // a story file that cannot be read may be the change, whatever else changed
  const catalogueProblems = changed.uiFiles.length > 0 ? changed.problems : (changed.unread ?? []);
  const isBlind = changed.files.length === 0 && !isSinceNamed;
  const verdict = verdictOf(uiFiles, problems, skipped, catalogueProblems, isBlind, notVerified.length);
  const allSkipped = [...skipped, ...catalogueProblems];
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
      ...(code.excused === undefined ? {} : { excused: code.excused })
    },
    problems
  };
  const summary = summaryOf({ ...body, verdict, skipped: allSkipped }, catalogueProblems);
  return { schema: 2, verdict, summary, skipped: allSkipped, ...body };
};
