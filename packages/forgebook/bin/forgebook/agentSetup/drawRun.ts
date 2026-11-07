/**
 * What `forgebook init --draw` runs: draws a story of the project in a real browser, trying components until one draws, and
 * says why each that did not.
 *
 * @remarks
 * Each step is the project's own installed `forgebook`, as a person or an agent would run it, in a process of its own: the
 * command that started this one may be another copy (`npx`), and a catalogue's configuration imports the project's.
 * Stories the project has come first. A file this run wrote stays only if its story drew; the others are removed, so a
 * failed run leaves nothing behind. Starting a catalogue runs the project's code (its `vite.config`, its components), which
 * is why this is asked for by name and `forgebook init` alone never does it. When several components fail alike the
 * reason is not the component, so the run stops early and says so.
 *
 * @module
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { isStoryCheckReport, isStoryShotReport, type StoryCheckResult } from "../../../src/storyCheck.ts";
import type { AgentComponent, StoriesDocument } from "../../../src/vite/agent.types.ts";
import { isStoriesDocument } from "../../../src/vite/agentApi.ts";
import { drawCandidates } from "./drawCandidates.ts";
import { BLANK, type DrawDiagnosis, type DrawFailureKind, diagnosed } from "./drawDiagnosis.ts";
import { isUniformPicture } from "./uniformPicture.ts";

/** How long one step may run, in ms: a first start pre-bundles a whole app's dependencies. */
const STEP_MS = 240_000;

/** How long a command's streams may stay open after it ended, in ms. */
const STREAMS_MS = 2000;

/** How long the whole run may take, in ms: an unattended command must end. */
const RUN_MS = 600_000;

/** How many components may fail alike before the reason is taken not to be theirs. */
const SAME_FAILURES = 3;

/** One component tried. */
export type DrawAttempt = {
  /** The component's file, or the story's when the project had it; from the project's folder. */
  readonly file: string;
  /** Why it did not draw. */
  readonly diagnosis: DrawDiagnosis;
};

/** What came of trying to draw. */
export type DrawResult = {
  /** Whether a story drew, none was tried, or all that were tried failed. */
  readonly status: "drawn" | "failed" | "not-run";
  /** The story that drew, by its id. */
  readonly story: string | undefined;
  /** The story file it is in, from the project's folder. */
  readonly storyFile: string | undefined;
  /** Whether this run wrote that file. */
  readonly isWritten: boolean;
  /** The picture of it, absolute. */
  readonly picture: string | undefined;
  /** What was tried before it, each with why it did not draw. */
  readonly attempts: readonly DrawAttempt[];
  /** Why the run stopped short; none when it went through all it could. */
  readonly stoppedBecause: string | undefined;
  /** The wrappers of the app's entry written into the preview for it to draw; none when it needed none. */
  readonly liftedProviders?: readonly string[];
};

/** What a step's process said. */
type StepOutput = { readonly stdout: string; readonly stderr: string; readonly isOk: boolean };

/** Where the steps run. */
export type DrawContext = {
  /** The project's folder. */
  readonly dir: string;
  /** The adapter's name. */
  readonly framework: string;
  /** The top folders to look for components in; every one when none. */
  readonly folders?: readonly string[];
  /**
   * Gives the preview the providers of the app's entry: a way to undo it, when it could; run when components fail for want
   * of one.
   */
  readonly liftProviders?: () => { readonly names: readonly string[]; readonly undo: () => void } | undefined;
  /** Writes what a framework's tools write on install and an install without scripts leaves undone; none has none. */
  readonly prepare?: () => Promise<void>;
  /** Runs the project's `forgebook` with these arguments. */
  readonly run: (args: readonly string[]) => Promise<StepOutput>;
};

/**
 * The file of the `forgebook` command a project installed; none when it has not.
 *
 * @remarks
 * Run by Node and not through the package manager, which reads some of the arguments as its own: Yarn 1 takes `--json`.
 *
 * @param dir - the project's folder.
 */
export const installedForgebook = (dir: string): string | undefined => {
  const folder = join(dir, "node_modules", "forgebook");
  if (existsSync(join(folder, "package.json"))) {
    const real = realpathSync(folder);
    const parsed: unknown = JSON.parse(readFileSync(join(real, "package.json"), "utf8"));
    const bin = typeof parsed === "object" && parsed !== null && "bin" in parsed ? parsed.bin : undefined;
    const file = typeof bin === "object" && bin !== null && "forgebook" in bin ? bin.forgebook : undefined;
    return typeof file === "string" ? join(real, file) : undefined;
  }
  const parent = dirname(dir);
  return parent === dir ? undefined : installedForgebook(parent);
};

/**
 * Runs the project's own `forgebook`.
 *
 * @param dir - the project's folder.
 * @param env - the environment.
 */
export const projectForgebook =
  (dir: string, env: Readonly<Record<string, string | undefined>>) =>
  (args: readonly string[]): Promise<StepOutput> =>
    new Promise((resolve) => {
      const file = installedForgebook(dir);
      if (file === undefined) {
        resolve({ stdout: "", stderr: "forgebook is not installed in this project", isOk: false });
        return;
      }
      // ended by the command's own exit: a plugin of the app's may leave a watcher behind that holds these streams open
      const child = spawn(process.execPath, [file, ...args], {
        cwd: dir,
        env: { ...env, NO_COLOR: "1" },
        stdio: ["ignore", "pipe", "pipe"]
      });
      const out: string[] = [];
      const err: string[] = [];
      child.stdout.setEncoding("utf8").on("data", (chunk: string) => out.push(chunk));
      child.stderr.setEncoding("utf8").on("data", (chunk: string) => err.push(chunk));
      const timer = setTimeout(() => {
        err.push(`\nThe command took over ${STEP_MS / 1000} s, and was stopped: timed out`);
        child.kill("SIGKILL");
      }, STEP_MS);
      let isFinished = false;
      const finish = (isOk: boolean): void => {
        if (isFinished) return;
        isFinished = true;
        clearTimeout(timer);
        resolve({ stdout: out.join(""), stderr: err.join(""), isOk });
        child.stdout.destroy();
        child.stderr.destroy();
      };
      child.once("error", (error) => {
        err.push(error.message);
        finish(false);
      });
      let exitCode: number | null = null;
      child.once("close", (code) => finish(code === 0));
      child.once("exit", (code) => {
        exitCode = code;
        // what it wrote just before it ended is still on its way, until "close"; a watcher a plugin left behind holds its
        // streams open, and "close" then never comes
        setTimeout(() => finish(exitCode === 0), STREAMS_MS);
      });
    });

/** A framework's generated folder, which its `tsconfig.json` extends, and the command in its package that writes it. */
const GENERATED_FOLDERS: Readonly<Record<string, { folder: string; bin: string; args: readonly string[] }>> =
  {
    sveltekit: { folder: ".svelte-kit", bin: "svelte-kit", args: ["sync"] },
    nuxt: { folder: ".nuxt", bin: "nuxt", args: ["prepare"] }
  };

/**
 * Writes a framework's generated folder when it is missing: its `prepare` script does on an install, and every module fails
 * to compile without it after one that ran no scripts. A failure is left for the stories to say.
 *
 * @param dir - the project's folder.
 * @param framework - the adapter's name.
 * @param env - the environment.
 */
export const prepareGenerated = async (
  dir: string,
  framework: string,
  env: Readonly<Record<string, string | undefined>>
): Promise<void> => {
  const generated = GENERATED_FOLDERS[framework];
  if (generated === undefined || existsSync(join(dir, generated.folder))) return;
  const bin = join(dir, "node_modules", ".bin", generated.bin);
  if (!existsSync(bin)) return;
  await new Promise<void>((resolve) => {
    const child = spawn(bin, [...generated.args], {
      cwd: dir,
      env: { ...env },
      stdio: "ignore",
      shell: process.platform === "win32"
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), STEP_MS);
    const finish = (): void => {
      clearTimeout(timer);
      resolve();
    };
    child.once("error", finish);
    child.once("exit", finish);
  });
};

/** A document a step printed; none when it printed something else. */
const parsedDocument = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** Why one story's result does not count as drawn; none when it does. */
export const resultProblem = (result: StoryCheckResult): DrawDiagnosis | undefined => {
  // a request that failed (a font, a picture, an API) says nothing of whether the story drew
  const stopping = result.problems.filter(
    ({ kind, message }) => kind === "frame" || (kind === "error" && !/^Failed to load resource/.test(message))
  );
  if (stopping.length > 0) return diagnosed(stopping.map(({ message }) => message).join("\n"));
  if (result.notVerified !== undefined) return diagnosed(result.notVerified);
  return result.isBlank === true ? BLANK : undefined;
};

/** What a step said of its failure. */
const stepFailure = ({ stdout, stderr }: StepOutput): DrawDiagnosis => diagnosed(stderr.trim() || stdout);

/** The lines of a server's log that name an error, without their stacks. */
const SERVER_ERROR = /^.*\b(?:Internal server error|Pre-transform error|Error):\s.*$/m;

/** A diagnosis with what the server said when the page's words name nothing. */
const diagnosedWithServer = (problem: DrawDiagnosis, serverSaid: string): DrawDiagnosis => {
  const line = serverSaid.match(SERVER_ERROR)?.[0];
  return line === undefined ? problem : diagnosed(line);
};

/** Checks one story in the default view: why it did not draw, or none. */
const checkStory = async ({ run }: DrawContext, id: string): Promise<DrawDiagnosis | undefined> => {
  const output = await run(["check", id, "--json"]);
  const report = parsedDocument(output.stdout);
  if (!isStoryCheckReport(report)) return stepFailure(output);
  const [result] = report.results;
  if (result === undefined) return diagnosed(`No result for ${id}`);
  const problem = resultProblem(result);
  // a module the server could not compile says only "500" in the page; the server said why, on its own stream
  return problem?.kind === "unknown" ? diagnosedWithServer(problem, output.stderr) : problem;
};

/** The picture of a story that drew: its file, or none when it cannot be taken, which does not undo the drawing. */
const pictureOf = async ({ run }: DrawContext, id: string): Promise<string | undefined> => {
  const report = parsedDocument((await run(["shot", id, "--json"])).stdout);
  return isStoryShotReport(report) ? report.shots[0]?.file : undefined;
};

/** The catalogue's stories, or why they cannot be listed. */
const listedStories = async ({ run }: DrawContext): Promise<StoriesDocument | DrawDiagnosis> => {
  const output = await run(["stories", "--json"]);
  const document = parsedDocument(output.stdout);
  return isStoriesDocument(document) ? document : stepFailure(output);
};

/** The first story of the component a story file holds. */
const firstStoryOf = (components: readonly AgentComponent[], file: string): string | undefined =>
  components.find((component) => component.files.some((each) => each.endsWith(file)))?.stories[0]?.id;

/** What a run has found so far. */
type Progress = { readonly attempts: DrawAttempt[] };

/** What is a component's own however many have it: another may well draw. */
const OF_THE_COMPONENT: readonly DrawFailureKind[] = ["no-component", "blank", "needs-props"];

/** Whether the last failures are all alike: the same kind and the same words. */
const isSameFailure = (attempts: readonly DrawAttempt[]): boolean => {
  const last = attempts.slice(-SAME_FAILURES);
  const [first] = last;
  return (
    last.length === SAME_FAILURES &&
    first !== undefined &&
    !OF_THE_COMPONENT.includes(first.diagnosis.kind) &&
    last.every(
      ({ diagnosis }) =>
        diagnosis.kind === first.diagnosis.kind && diagnosis.message === first.diagnosis.message
    )
  );
};

/** What a story that passed its checks came to: a run that drew, or a picture of nothing. */
const drawnOrBlank = async (
  context: DrawContext,
  story: string,
  storyFile: string,
  isWritten: boolean,
  { attempts }: Progress
): Promise<DrawResult | undefined> => {
  const picture = await pictureOf(context, story);
  if (picture !== undefined && existsSync(picture) && isUniformPicture(readFileSync(picture))) {
    rmSync(picture, { force: true });
    return undefined;
  }
  return { status: "drawn", story, storyFile, isWritten, picture, attempts, stoppedBecause: undefined };
};

/** A run that drew nothing. */
const notDrawn = (attempts: readonly DrawAttempt[], stoppedBecause: string | undefined): DrawResult => ({
  status: "failed",
  story: undefined,
  storyFile: undefined,
  isWritten: false,
  picture: undefined,
  attempts,
  stoppedBecause
});

/** A run that has no browser to draw in: nothing can pass until there is one. */
const noBrowser = (attempts: readonly DrawAttempt[]): DrawResult =>
  notDrawn(attempts, "No browser to draw in: nothing can pass until it is installed");

/** Tries the stories the project has already: one that draws ends the run. */
const tryExisting = async (
  context: DrawContext,
  progress: Progress,
  components: readonly AgentComponent[]
): Promise<DrawResult | undefined> => {
  for (const component of components.slice(0, SAME_FAILURES)) {
    const story = component.stories[0];
    if (story === undefined) continue;
    const problem = await checkStory(context, story.id);
    const result =
      problem === undefined ? await drawnOrBlank(context, story.id, story.file, false, progress) : undefined;
    if (result !== undefined) return result;
    progress.attempts.push({ file: story.file, diagnosis: problem ?? BLANK });
  }
  return undefined;
};

/** The component to choose in a file of several: its name's, or the first. */
export const chosenExport = (file: string, names: readonly string[]): string | undefined => {
  const base = basename(file)
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
  return names.find((name) => name.toLowerCase() === base) ?? names[0];
};

/** Writes a component's first stories, choosing one when the file exports several. */
const writeStories = async ({ run }: DrawContext, file: string): Promise<StepOutput> => {
  const written = await run(["new", file, "--json"]);
  const several = written.stderr.match(/exports several components \(([^)]*)\)/)?.[1];
  if (several === undefined) return written;
  const chosen = chosenExport(file, several.split(", "));
  return chosen === undefined ? written : run(["new", file, "--export", chosen, "--json"]);
};

/** Draws the first story of a file just written: its id, and why it did not draw. */
const drawWritten = async (
  context: DrawContext,
  storyFile: string
): Promise<{ readonly story?: string; readonly problem?: DrawDiagnosis | undefined }> => {
  const listed = await listedStories(context);
  if ("kind" in listed) return { problem: listed };
  const story = firstStoryOf(listed.components, storyFile);
  if (story === undefined) return { problem: diagnosed(`The file ${storyFile} gave no story`) };
  return { story, problem: await checkStory(context, story) };
};

/** Writes one component's first stories and draws the first: its file written, or why it did not draw. */
const tryComponent = async (
  context: DrawContext,
  file: string,
  progress: Progress
): Promise<DrawResult | undefined> => {
  const written = await writeStories(context, file);
  const document = parsedDocument(written.stdout);
  const storyFile =
    typeof document === "object" &&
    document !== null &&
    "file" in document &&
    typeof document.file === "string"
      ? document.file
      : undefined;
  if (storyFile === undefined) {
    progress.attempts.push({ file, diagnosis: stepFailure(written) });
    return undefined;
  }
  const { story, problem } = await drawWritten(context, storyFile);
  const result =
    problem === undefined && story !== undefined
      ? await drawnOrBlank(context, story, storyFile, true, progress)
      : undefined;
  if (result !== undefined) return result;
  rmSync(join(context.dir, storyFile), { force: true });
  progress.attempts.push({ file, diagnosis: problem ?? BLANK });
  return undefined;
};

/**
 * Tries again the components that wanted a provider, with the app's own in the preview; the preview goes back as it was when
 * none draws.
 */
const drawnWithProviders = async (
  context: DrawContext,
  progress: Progress
): Promise<DrawResult | undefined> => {
  const wanting = progress.attempts
    .filter(({ diagnosis }) => diagnosis.kind === "provider")
    .slice(0, SAME_FAILURES);
  if (wanting.length === 0) return undefined;
  const lifted = context.liftProviders?.();
  if (lifted === undefined) return undefined;
  for (const { file } of wanting) {
    const tried: Progress = { attempts: progress.attempts };
    const result = await tryComponent(context, file, tried);
    if (result !== undefined) return { ...result, liftedProviders: lifted.names };
  }
  lifted.undo();
  return undefined;
};

/** A run that should stop after its last failure; none when another component is worth a try. */
const stoppedShort = (attempts: readonly DrawAttempt[]): DrawResult | undefined => {
  const latest = attempts.at(-1)?.diagnosis;
  if (latest?.kind === "browser") return noBrowser(attempts);
  return isSameFailure(attempts)
    ? notDrawn(
        attempts,
        `${SAME_FAILURES} components failed alike, so the reason is not theirs: ${latest?.nextStep ?? ""}`
      )
    : undefined;
};

/** Tries the components in turn: the first that draws, or what came of them. */
const tryCandidates = async (
  context: DrawContext,
  candidates: readonly string[],
  progress: Progress
): Promise<DrawResult> => {
  const startedAt = Date.now();
  for (const file of candidates) {
    if (Date.now() - startedAt > RUN_MS)
      return notDrawn(progress.attempts, `Stopped after ${RUN_MS / 60_000} minutes: each try takes long`);
    const result = await tryComponent(context, file, progress);
    if (result !== undefined) return result;
    const stopped = stoppedShort(progress.attempts);
    if (stopped !== undefined) return (await drawnWithProviders(context, progress)) ?? stopped;
  }
  return (await drawnWithProviders(context, progress)) ?? notDrawn(progress.attempts, undefined);
};

/**
 * Draws a story of the project.
 *
 * @param context - where the steps run.
 */
export const runDraw = async (context: DrawContext): Promise<DrawResult> => {
  const progress: Progress = { attempts: [] };
  await context.prepare?.();
  const hasStories = await listedStories(context);
  if (!("kind" in hasStories)) {
    const fromProject = await tryExisting(context, progress, hasStories.components);
    if (fromProject !== undefined) return fromProject;
    if (progress.attempts.at(-1)?.diagnosis.kind === "browser") return noBrowser(progress.attempts);
  }
  const candidates = drawCandidates(context.dir, context.framework, context.folders);
  if (candidates.length === 0 && progress.attempts.length === 0)
    return notDrawn(
      [],
      "No component file was found: write a story by hand, or run forgebook new <component file>"
    );
  return tryCandidates(context, candidates, progress);
};
