/**
 * What `forgebook verify` and its MCP tool run: asks the catalogue what the change is and adds, runs the stories that
 * reach it on one browser, and concludes (`verifyVerdict.ts`).
 *
 * @remarks
 * A check that cannot run does not stop the answer: the coverage and the code check still say what they found, and the
 * stories that did not run cover nothing, so a project with no browser is told it is not verified rather than given only
 * an error. Tokens files it cannot read leave the code unchecked, which the verdict says. Only a commit that names nothing
 * ends it, since then there is no change to speak of.
 *
 * @module
 */
import type { StoryCheckReport } from "../../src/storyCheck.ts";
import type { CheckedCodeDocument, VerifyDocument } from "../../src/vite/agent.types.ts";
import { isChangedStoriesDocument, isCheckedCodeDocument } from "../../src/vite/agentApi.ts";
import { branchStart, changeBase, noBaseReason } from "../../src/vite/gitChange.ts";
import type { Ask } from "./mcpToolParts.ts";
import type { StoriesCheckInput } from "./storyCheckRun.ts";
import { verifyDocument } from "./verifyVerdict.ts";

/** What a verification reaches the catalogue through. */
export type VerifyReach = {
  /** The catalogue's folder, in the repository. */
  readonly dir: string;
  /** Asks the catalogue. */
  readonly ask: Ask;
  /** Runs the checks on stories: the report, or why it could not run. */
  readonly check: (input: StoriesCheckInput) => Promise<StoryCheckReport | string>;
};

/** What a verification is asked. */
export type VerifyInput = {
  /** The commit to compare with; the default branch when none. */
  readonly since: string | undefined;
  /** Only the default view of each story. */
  readonly isQuick: boolean;
  /**
   * What is wrong with the catalogue's configuration that leaves the answer not verified, said with it: a story pattern
   * that matches nothing. None by default.
   */
  readonly configProblems?: readonly string[];
};

/** What a catalogue answers when it runs an older version than this command. */
const UNEXPECTED_SHAPE =
  "The catalogue's answer has an unexpected shape: restart forgebook dev if it runs another version";

/** The message of an answer that is an error. */
const errorOf = (body: unknown, status: number): string =>
  typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
    ? body.error
    : `The catalogue answered ${status}`;

/**
 * Whether an answer means the change is not done: what `verify` exits non-zero on.
 *
 * @param document - the answer.
 */
export const isVerifyFailure = (document: VerifyDocument): boolean =>
  document.verdict === "failed" || document.verdict === "not-verified";

/** Runs the stories' check, a thrown failure (a browser that will not start) being a reason as any other. */
const checked = async (reach: VerifyReach, input: StoriesCheckInput): Promise<StoryCheckReport | string> => {
  try {
    return await reach.check(input);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

/**
 * Answers whether a change is verified.
 *
 * @param reach - what it reaches the catalogue through.
 * @param input - what to compare with, and how much to run.
 * @returns the answer, or why there can be none.
 */
export const runVerify = async (
  reach: VerifyReach,
  { since, isQuick, configProblems = [] }: VerifyInput
): Promise<VerifyDocument | string> => {
  const named = since ?? (await branchStart(reach.dir));
  const base = await changeBase(reach.dir, named);
  if (base === undefined) return noBaseReason(reach.dir, named);
  const params = new URLSearchParams({ since: named });
  const code = await reach.ask("check-code", params);
  if (code.status === 200 && !isCheckedCodeDocument(code.body)) return UNEXPECTED_SHAPE;
  const changed = await reach.ask("changed", params);
  if (changed.status !== 200) return errorOf(changed.body, changed.status);
  if (!isChangedStoriesDocument(changed.body)) return UNEXPECTED_SHAPE;
  const ids = changed.body.stories.map((story) => story.id);
  const run = ids.length === 0 ? undefined : await checked(reach, { ids, isAllVariants: !isQuick });
  // tokens that cannot be read leave the code unchecked, which the verdict says, and do not stop the rest
  const codeBody: CheckedCodeDocument = isCheckedCodeDocument(code.body)
    ? code.body
    : {
        schema: 1,
        since: named,
        checked: [],
        skipped: [`colours, sizes and turned-off checks not checked: ${errorOf(code.body, code.status)}`],
        problems: []
      };
  return verifyDocument({
    since: named,
    base,
    changed: changed.body,
    code: codeBody,
    report: typeof run === "object" ? run : undefined,
    notRun: typeof run === "string" ? run : undefined,
    isQuick,
    isSinceNamed: since !== undefined,
    configProblems
  });
};
