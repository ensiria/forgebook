/**
 * What `forgebook proof` runs: where a change started and the change, each drawn in this run on this machine, and their
 * pictures compared.
 *
 * @remarks
 * Nothing is stored between runs, so there is no baseline for anyone to approve: the "before" is drawn from the merge base
 * here, in a checkout of its own with its own install and its own `forgebook dev`, and thrown away. The folder of baselines
 * a project may keep is never read. Pictures from one machine in one job leave rendering out of the difference, and what
 * still differs is pictured a second time from the same code: a state that differs then too is `unstable`, and proves
 * nothing. The code under review runs in this job and could lie about all of this, so the answer names the files that make
 * the proof whenever the change edits them, for a person to read.
 *
 * @module
 */
import { type ChildProcess, execFile, spawn } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { promisify } from "node:util";

import type { StoryDiff, StoryDiffReport, StoryShot } from "../../src/storyCheck.ts";
import type {
  ProofDocument,
  ProofState,
  StoriesDocument,
  VerifyDocument
} from "../../src/vite/agent.types.ts";
import { isStoriesDocument } from "../../src/vite/agentApi.ts";
import { AGENT_API } from "../../src/vite/agentRoutes.ts";
import { findConfigFile, type ResolvedConfig } from "../../src/vite/configFile.ts";
import { changeBase, gitOutput, noBaseReason } from "../../src/vite/gitChange.ts";
import { installCommandOf } from "./proofWorkflow.ts";
import { runStoriesDiff, runStoriesShot, type StoriesCheckInput, testingFunction } from "./storyCheckRun.ts";

const run = promisify(execFile);

/** How long the base's server may take to answer, in ms: a first start builds its programs and prebundles. */
const BASE_READY_MS = 300_000;

/** How much of what the base's server says is kept, in characters. */
const SERVER_WORDS = 1500;

/** How long an install may take, in ms. */
const INSTALL_MS = 900_000;

/** The files that make the proof, not what it shows: an edit to them is read by a person, whatever the pictures say. */
export const MAKES_THE_PROOF =
  /^(?:\.github\/|patches\/|.*(?:forgebook\.(?:config|preview)\.[^/]+|vite\.config\.[^/]+|package\.json|package-lock\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|yarn\.lock|bun\.lock|\.npmrc|\.yarnrc\.yml|\.pnpmfile\.c?js)$)/;

/** What `runProof` is asked. */
export type ProofInput = {
  /** The ref the change is compared with. */
  readonly base: string;
  /** The folder the proof is written in, absolute. */
  readonly out: string;
  /** Where the base's checkout goes, absolute; the system's temporary folder by default. */
  readonly work: string | undefined;
  /** The command that installs the base's checkout; from its lockfile by default. */
  readonly install: string | undefined;
  /** Every story, not only those the change reaches: what shows whether two builds of one commit draw the same. */
  readonly isAll: boolean;
  /** Only the default view of each story. */
  readonly isQuick: boolean;
  /** The most stories pictured; those past it are named as not checked. */
  readonly maxStories: number;
};

/** What `runProof` reaches the change's catalogue through. */
export type ProofReach = {
  /** The catalogue's configuration. */
  readonly config: ResolvedConfig;
  /** The configuration file named on the command line: each side's server is told the same. */
  readonly configFile: string | undefined;
  /** Answers whether the change is verified. */
  readonly verify: (since: string) => Promise<VerifyDocument | string>;
  /** Every story the catalogue lists. */
  readonly stories: () => Promise<StoriesDocument | string>;
  /** Every story a change reaches, by id: `verify` lists only the first of them. */
  readonly changedIds: (since: string) => Promise<readonly string[] | string>;
  /** Writes progress for a person. */
  readonly say: (text: string) => void;
};

/**
 * The listed stories' ids in a catalogue's answer.
 *
 * @param document - the answer.
 */
export const listedIds = (document: StoriesDocument): readonly string[] =>
  document.components.flatMap((component) =>
    component.stories.filter((story) => !story.isUnlisted).map((story) => story.id)
  );

/**
 * Every story's id in a catalogue's answer, those listed nowhere among them.
 *
 * @param document - the answer.
 */
export const allIds = (document: StoriesDocument): readonly string[] =>
  document.components.flatMap((component) => component.stories.map((story) => story.id));

/** A port free right now. */
const freePort = (): Promise<number> =>
  new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      probe.close(() => resolvePort(port));
    });
  });

/** Waits until a server answers with its stories, or says why it will not. */
const serverStories = async (origin: string, server: ChildProcess): Promise<StoriesDocument | string> => {
  const deadline = Date.now() + BASE_READY_MS;
  while (Date.now() < deadline) {
    // a server stopped by a signal has no exit code, and would be waited for to the end
    if (server.exitCode !== null || server.signalCode !== null)
      return `A forgebook dev started for this run stopped (${server.exitCode ?? server.signalCode})`;
    const body: unknown = await fetch(`${origin}${AGENT_API}stories`)
      .then((response) => response.json())
      .catch(() => undefined);
    if (isStoriesDocument(body)) return body;
    await new Promise((wake) => {
      setTimeout(wake, 500);
    });
  }
  return `A forgebook dev started for this run did not answer in ${BASE_READY_MS / 1000} s`;
};

/** The base's picture of a state, copied beside the others, and the marked one, moved: what a reviewer downloads. */
const stateOf = (
  result: StoryDiff & { readonly status: ProofState["status"] },
  out: string,
  isUnstable: boolean
): ProofState => {
  const pictures = join(out, "pictures");
  const keep = (file: string | undefined, name: string): string | undefined => {
    if (file === undefined || !existsSync(file)) return undefined;
    const kept = join(pictures, `${name}-${basename(file)}`);
    copyFileSync(file, kept);
    return relative(out, kept).replaceAll("\\", "/");
  };
  const before = result.status === "new" ? undefined : keep(result.baseline, "before");
  const after = result.status === "removed" ? undefined : keep(result.current, "after");
  const marked = keep(result.diff, "marked");
  return {
    storyId: result.storyId,
    view: result.view,
    status: isUnstable ? "unstable" : result.status,
    percent: result.percent,
    pictures: {
      ...(before === undefined ? {} : { before }),
      ...(after === undefined ? {} : { after }),
      ...(marked === undefined ? {} : { marked })
    }
  };
};

/** A state's key in a comparison. */
const keyOf = (result: Pick<StoryDiff, "storyId" | "view">): string => `${result.storyId}\n${result.view}`;

/** What the change edits of what makes the proof. */
const ownFilesOf = async (dir: string, base: string): Promise<readonly string[]> => {
  const listed = await gitOutput(
    dir,
    "diff",
    "--no-ext-diff",
    "--no-relative",
    "--name-only",
    "-z",
    base,
    "--"
  );
  return listed.split("\0").filter((file) => file !== "" && MAKES_THE_PROOF.test(file));
};

/** What was not checked, in words. */
const notCheckedOf = (
  verified: VerifyDocument,
  ownFiles: readonly string[],
  leftOut: readonly string[],
  states: readonly ProofState[],
  isQuick: boolean
): readonly string[] => {
  const unstable = states.filter((state) => state.status === "unstable").length;
  const broken = states.filter((state) => state.status === "broken").length;
  return [
    // first: a comment's cap cuts from the end, and this is what must not be lost
    ...(ownFiles.length === 0
      ? []
      : [`this change edits what makes this proof, so read these yourself: ${ownFiles.join(", ")}`]),
    ...verified.skipped,
    ...verified.uiFiles.flatMap((file) =>
      file.coverage === "none" ? [`${file.file}: ${file.reason ?? "no story reaches it"}`] : []
    ),
    ...verified.notVerified.map((each) => `${each.storyId} (${each.view}): ${each.notVerified}`),
    ...(leftOut.length === 0
      ? []
      : [`${leftOut.length} stories not pictured, past the limit: ${leftOut.slice(0, 20).join(", ")}`]),
    ...(unstable === 0
      ? []
      : [`${unstable} states differ between two pictures of the same code: their difference proves nothing`]),
    ...(broken === 0 ? [] : [`${broken} states did not draw, so their pictures prove nothing`]),
    ...(isQuick ? ["only the default view pictured: --quick"] : []),
    "real pages of the application, and anything no story shows"
  ];
};

/** What the base could draw. */
type BaseSide = {
  /** The stories it could not, whose "before" proves nothing. */
  readonly undrawn: readonly string[];
  /** The stories it has and the change does not. */
  readonly removed: readonly StoryShot[];
  /** Whether it has no catalogue at all, so every state reads as new. */
  readonly isWithoutCatalogue?: boolean;
};

/** The file a manifest's `forgebook` command starts. */
const binOf = (manifest: string): string | undefined => {
  const read: unknown = JSON.parse(readFileSync(manifest, "utf8"));
  const bin = typeof read === "object" && read !== null && "bin" in read ? read.bin : undefined;
  const file = typeof bin === "object" && bin !== null && "forgebook" in bin ? bin.forgebook : undefined;
  return typeof file === "string" ? join(dirname(manifest), file) : undefined;
};

/**
 * The file that starts a checkout's own `forgebook`, looked for as Node looks for a package: its manifest is not among
 * what it exports, so it cannot be asked for by name.
 *
 * @param dir - the catalogue's folder in the checkout.
 * @returns the file; none when no Forgebook is installed there.
 */
const forgebookEntry = (dir: string): string | undefined => {
  let folder = dir;
  while (dirname(folder) !== folder) {
    const manifest = join(folder, "node_modules", "forgebook", "package.json");
    if (existsSync(manifest)) return binOf(manifest);
    folder = dirname(folder);
  }
  return undefined;
};

/** A catalogue's `forgebook dev`, started for this run. */
type ServedSide = {
  /** Where it answers. */
  readonly origin: string;
  /** Its listed stories. */
  readonly stories: StoriesDocument;
  /** Stops it, and waits until it stopped. */
  readonly close: () => Promise<void>;
};

/**
 * Starts a checkout's own `forgebook dev`, and waits until it answers.
 *
 * @param dir - the catalogue's folder.
 * @param entry - the file that starts its `forgebook`.
 * @param configFile - the configuration file named on the command line, relative to the folder.
 * @returns the server, or why it would not answer.
 */
const servedSide = async (
  dir: string,
  entry: string,
  configFile: string | undefined
): Promise<ServedSide | string> => {
  const port = await freePort();
  const origin = `http://localhost:${port}`;
  const named = configFile === undefined ? [] : ["--config", configFile];
  const server = spawn(process.execPath, [entry, "dev", "--port", String(port), ...named], {
    cwd: dir,
    stdio: ["ignore", "ignore", "pipe"]
  });
  // the end of what it says is why it stopped, which a run in CI has no other way to tell
  let said = "";
  server.stderr?.on("data", (part: Buffer) => {
    said = `${said}${part.toString()}`.slice(-SERVER_WORDS);
  });
  const stories = await serverStories(origin, server);
  if (typeof stories !== "string")
    return {
      origin,
      stories,
      // waited for: the checkout it serves is removed next
      close: () =>
        new Promise((done) => {
          server.once("exit", () => done());
          server.kill();
        })
    };
  server.kill();
  return `${stories}${said === "" ? "" : `: ${said.trim()}`}`;
};

/**
 * Draws stories once and throws the pictures away. On a cold server the bundler finds a dependency mid-load and reloads the
 * page, and a frame then pictured nearly empty (a page 19 px tall where the same commit draws 1,068) reads as a change that
 * is not there.
 *
 * @param config - the side's configuration.
 * @param origin - its server.
 * @param input - the stories.
 * @param folder - where to throw them.
 */
const warmed = async (
  config: ResolvedConfig,
  origin: string,
  input: StoriesCheckInput,
  folder: string
): Promise<string | undefined> => {
  const shot = await runStoriesShot(config, origin, input, folder);
  return typeof shot === "string" ? shot : undefined;
};

/**
 * Pictures the base from its own checkout, install and server.
 *
 * @param reach - the change's catalogue.
 * @param input - what is asked.
 * @param commit - the commit to draw.
 * @param ids - the stories wanted.
 * @param headIds - every story the change has: one the base has and it does not was removed.
 * @param folder - where its pictures go.
 * @returns what it could draw, or why it could not run.
 */
const pictureBase = async (
  reach: ProofReach,
  input: ProofInput,
  commit: string,
  ids: readonly string[],
  headIds: ReadonlySet<string>,
  folder: string
): Promise<BaseSide | string> => {
  const { config, say } = reach;
  const root = (await gitOutput(config.dir, "rev-parse", "--show-toplevel")).trim();
  const work = mkdtempSync(join(input.work ?? tmpdir(), "forgebook-proof-"));
  const checkout = join(work, "base");
  let served: ServedSide | undefined;
  try {
    await gitOutput(root, "worktree", "add", "--quiet", "--detach", checkout, commit);
    const install = input.install ?? installCommandOf(checkout);
    if (install !== undefined && install !== "") {
      say(`Installing the base: ${install}`);
      await run(install, { cwd: checkout, shell: true, timeout: INSTALL_MS, maxBuffer: 64 * 1024 * 1024 });
    }
    // as the server will name it, or the client would not know it for this catalogue: a temporary folder is often a link
    const dir = join(realpathSync(checkout), relative(realpathSync(root), realpathSync(config.dir)));
    const entry = existsSync(dir) && findConfigFile(dir) !== undefined ? forgebookEntry(dir) : undefined;
    if (entry === undefined) return { undrawn: [], removed: [], isWithoutCatalogue: true };
    const side = await servedSide(dir, entry, reach.configFile);
    if (typeof side === "string") return side;
    served = side;
    const all = new Set(allIds(side.stories));
    const known = ids.filter((id) => all.has(id));
    const gone = listedIds(side.stories).filter((id) => !headIds.has(id));
    const wanted = [...known, ...gone];
    if (wanted.length === 0) return { undrawn: [], removed: [] };
    // the change's testing package and browser for both, or two versions would differ by themselves
    const stories = { ids: wanted, isAllVariants: !input.isQuick };
    say("Picturing the base");
    const cold = await warmed(config, side.origin, stories, join(work, "warm"));
    if (cold !== undefined) return cold;
    const shot = await runStoriesShot(config, side.origin, stories, folder);
    if (typeof shot === "string") return shot;
    const isGone = new Set(gone);
    return {
      undrawn: [
        ...new Set(shot.shots.filter((each) => each.status !== undefined).map((each) => each.storyId))
      ],
      removed: shot.shots.filter((each) => isGone.has(each.storyId))
    };
  } finally {
    await served?.close();
    await gitOutput(root, "worktree", "remove", "--force", checkout).catch(() => "");
    rmSync(work, { recursive: true, force: true, maxRetries: 3 });
  }
};

/** What was pictured, once both sides were. */
type Compared = {
  /** The comparison. */
  readonly report: StoryDiffReport;
  /** The states that differ when the same code is pictured again. */
  readonly unstable: ReadonlySet<string>;
  /** What the base could draw. */
  readonly side: BaseSide;
};

/**
 * Pictures both sides of the stories wanted, then what differs a second time. The change is served as the base is, by its
 * own `forgebook dev` and warmed the same way, so the two pictures differ by the change and not by how they were made.
 *
 * @param reach - the change's catalogue.
 * @param input - what is asked.
 * @param base - the commit the change started from.
 * @param ids - the stories.
 * @param headIds - every story the change has.
 * @param work - a folder to keep the pictures in while this runs.
 */
const comparedSides = async (
  reach: ProofReach,
  input: ProofInput,
  base: string,
  ids: readonly string[],
  headIds: ReadonlySet<string>,
  work: string
): Promise<Compared | string> => {
  const { say } = reach;
  const isAllVariants = !input.isQuick;
  const before = join(work, "before");
  const after = join(work, "after");
  mkdirSync(before);
  const pictured = await pictureBase(reach, input, base, ids, headIds, before);
  if (typeof pictured === "string") return pictured;
  const dir = realpathSync(reach.config.dir);
  const config = { ...reach.config, dir };
  const entry = forgebookEntry(dir);
  if (entry === undefined) return "This catalogue's folder has no Forgebook installed";
  const side = await servedSide(dir, entry, reach.configFile);
  if (typeof side === "string") return side;
  try {
    const stories = { ids, isAllVariants };
    say(`Picturing ${ids.length} stories with the change`);
    const cold = await warmed(config, side.origin, stories, join(work, "warm"));
    if (cold !== undefined) return cold;
    const report = await runStoriesDiff(config, side.origin, stories, { baselines: before, outDir: after });
    if (typeof report === "string") return report;
    const differing = report.results.filter((each) => each.status === "changed" || each.status === "resized");
    if (differing.length === 0) return { report, unstable: new Set(), side: pictured };
    // the same code again: what moves now is noise, and says nothing of the change
    say(`Picturing ${differing.length} differing states a second time`);
    const again = await runStoriesDiff(
      config,
      side.origin,
      { ids: [...new Set(differing.map((each) => each.storyId))], isAllVariants },
      { baselines: after, outDir: join(work, "control") }
    );
    if (typeof again === "string") return again;
    const unstable = new Set(again.results.filter((each) => each.status !== "same").map(keyOf));
    return { report, unstable, side: pictured };
  } finally {
    await side.close();
  }
};

/**
 * Compares a change with where it started, and writes the proof.
 *
 * @param reach - the change's catalogue.
 * @param input - what is asked.
 * @returns the proof, or why there can be none.
 */
export const runProof = async (reach: ProofReach, input: ProofInput): Promise<ProofDocument | string> => {
  const { config, say } = reach;
  const testing = await testingFunction(config.dir, "@forgebook/testing/diff", "diffStories");
  if (typeof testing === "string") return testing;
  const base = await changeBase(config.dir, input.base);
  if (base === undefined) return noBaseReason(config.dir, input.base);
  const head = (await gitOutput(config.dir, "rev-parse", "HEAD")).trim();
  say("Verifying the change");
  const verified = await reach.verify(input.base);
  if (typeof verified === "string") return verified;
  const stories = await reach.stories();
  if (typeof stories === "string") return stories;
  const reached = input.isAll ? listedIds(stories) : await reach.changedIds(input.base);
  if (typeof reached === "string") return reached;
  const ids = reached.slice(0, input.maxStories);
  const leftOut = reached.slice(input.maxStories);
  const headIds = new Set(allIds(stories));
  const work = mkdtempSync(join(input.work ?? tmpdir(), "forgebook-pictures-"));
  mkdirSync(join(input.out, "pictures"), { recursive: true });
  try {
    const compared =
      ids.length === 0
        ? {
            report: { schema: 1 as const, results: [] },
            unstable: new Set<string>(),
            side: { undrawn: [], removed: [] }
          }
        : await comparedSides(reach, input, base, ids, headIds, work);
    if (typeof compared === "string") return compared;
    const { report, unstable, side } = compared;
    const states = [
      ...report.results.flatMap((each) =>
        each.status === "same"
          ? []
          : [stateOf({ ...each, status: each.status }, input.out, unstable.has(keyOf(each)))]
      ),
      ...side.removed.map((shot) =>
        stateOf(
          {
            storyId: shot.storyId,
            view: shot.view,
            status: "removed",
            changedPixels: 0,
            percent: 100,
            baseline: shot.file,
            current: ""
          },
          input.out,
          false
        )
      )
    ];
    return {
      schema: 1,
      base,
      head,
      verdict: verified.verdict,
      summary: verified.summary,
      states,
      same: report.results.filter((each) => each.status === "same").length,
      checked: [
        `pictures of ${ids.length} stories, ${input.isQuick ? "default view" : "every variant"}, from two builds in this run`,
        `check-code: ${verified.code.checked.join(", ") || "nothing"}`,
        `${verified.ran} story and view pairs through the checks (accessibility, spills, overlays, page errors)`
      ],
      notChecked: [
        ...notCheckedOf(verified, await ownFilesOf(config.dir, base), leftOut, states, input.isQuick),
        ...(side.undrawn.length === 0
          ? []
          : [`did not draw at the base, so their "before" proves nothing: ${side.undrawn.join(", ")}`]),
        ...(side.isWithoutCatalogue === true
          ? ["the base has no catalogue to draw, or no Forgebook installed: every state reads as new"]
          : [])
      ]
    };
  } finally {
    rmSync(work, { recursive: true, force: true, maxRetries: 3 });
  }
};

/**
 * Writes a proof's files.
 *
 * @param out - the folder.
 * @param files - each file's name and text.
 */
export const writeProofFiles = (out: string, files: Readonly<Record<string, string>>): void => {
  mkdirSync(out, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(out, name), text);
};
