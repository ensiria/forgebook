/**
 * The tools of a run made ready: installed on the generated library, or set beside a real one's stories.
 *
 * @module
 */
import { dirname, join } from "node:path";

import type { ScriptIo } from "@ensiria/cli-kit/io.types";
import type { Browser } from "@playwright/test";

import type { BenchReport, MetricResult, ToolName } from "./bench.types.ts";
import { buildCorpus, type CorpusSize } from "./corpus.ts";
import type { MeasureContext } from "./measure.ts";
import {
  type BenchFolders,
  type InstallResult,
  installedVersion,
  installOnBare,
  installTarget,
  targetSource,
  writeProject
} from "./prepare.ts";
import { prepareCorpus } from "./prepareCorpus.ts";
import type { CorpusPaths, RealCorpus } from "./realCorpus.types.ts";
import type { RunActivity } from "./statusFile.ts";
import { generatedSubject, realSubject } from "./subject.ts";
import { libraryStorybook, type Target, withPorts } from "./targets.ts";

/** A real library to run on, instead of the generated one. */
export type RealRun = {
  /** The corpus. */
  readonly corpus: RealCorpus;
  /** Where it lives. */
  readonly paths: CorpusPaths;
};

/** A tool's state during a run. */
export type ToolRun = {
  /** How it is measured. */
  readonly context: MeasureContext;
  /** Its metrics so far. */
  readonly metrics: Record<string, MetricResult>;
  /** Its install, measured; none on a real library, where the tool stands beside what the library installs. */
  readonly install?: { readonly result: InstallResult; readonly onBare: number };
};

/** What the preparation reads of a benchmark's request. */
export type PrepareRequest = {
  /** The first port of the run; each tool takes the next, so a server that lingers cannot answer for another. */
  readonly port: number;
  /** Where to work. */
  readonly folders: BenchFolders;
  /** The tools. */
  readonly targets: readonly Target[];
  /** Forgebook's packages: tarballs or a published version. */
  readonly forgebookPackages: Readonly<Record<string, string>>;
  /** The generated corpus's size. */
  readonly size: CorpusSize;
  /** The browser's CPU throttle, 1 for none. */
  readonly throttle: number;
  /** The script's streams. */
  readonly io: ScriptIo;
  /** Told when a long step starts, for the status file. */
  readonly onActivity: (activity: RunActivity) => void;
};

/** What the tools of a run are prepared into. */
export type PreparedRun = {
  /** The browser. */
  readonly browser: Browser;
  /** The metrics by tool, filled as the run goes. */
  readonly report: Partial<Record<ToolName, Record<string, MetricResult>>>;
  /** The versions by tool. */
  readonly versions: Partial<Record<ToolName, Record<string, string>>>;
  /** The tools ready to measure. */
  readonly tools: ToolRun[];
};

/** Why a tool could not be prepared, as a metric: one tool's problem does not lose the others' hours. */
const failedInstall = (error: unknown): MetricResult => ({
  kind: "failed",
  reason: error instanceof Error ? error.message : String(error)
});

/** Where the tools' builds are written, inside the work folder and outside any project or clone. */
const BUILDS_FOLDER = "builds";

/**
 * Prepares the tools on the generated library.
 *
 * @param request - the benchmark.
 * @param prepared - what to fill.
 * @returns the name of the component measured.
 */
export const prepareGenerated = async (request: PrepareRequest, prepared: PreparedRun): Promise<string> => {
  const { folders, targets, io, size } = request;
  const corpus = buildCorpus(size);
  const bareSource = targetSource(folders.repository, "bare");
  request.onActivity({ state: "working", activity: "install" });
  const bare = await installTarget(bareSource, join(folders.work, "bare"), undefined, io);
  const forgebookOnly = (target: Target): Readonly<Record<string, string>> | undefined =>
    target.name === "forgebook" ? request.forgebookPackages : undefined;
  for (const { target, port } of withPorts(targets, request.port)) {
    const directory = join(folders.work, target.name);
    const metrics: Record<string, MetricResult> = {};
    prepared.report[target.name] = metrics;
    try {
      request.onActivity({ state: "working", activity: "install", tool: target.name });
      const source = targetSource(folders.repository, target.name);
      const result = await installTarget(source, directory, forgebookOnly(target), io);
      request.onActivity({ state: "working", activity: "install", tool: target.name });
      const onBare = await installOnBare(source, bareSource, join(folders.work, `${target.name}-on-bare`), {
        packages: forgebookOnly(target),
        bareSize: bare.size,
        io
      });
      await writeProject(target, corpus, directory);
      const named = await Promise.all(
        target.packages.map(async (name) => [name, await installedVersion(directory, name)] as const)
      );
      prepared.versions[target.name] = Object.fromEntries(named);
      prepared.tools.push({
        context: {
          target,
          directory,
          buildFolder: join(folders.work, BUILDS_FOLDER, "generated", target.name),
          browser: prepared.browser,
          port,
          subject: generatedSubject(target, corpus.measured, directory),
          throttle: request.throttle,
          io
        },
        metrics,
        install: { result, onBare }
      });
    } catch (error) {
      metrics["install"] = failedInstall(error);
    }
  }
  return corpus.measured.name;
};

/** The version of a package a folder resolves, walking up: a library hoists what it installs. */
const resolvedVersion = async (directory: string, name: string): Promise<string> => {
  for (let folder = directory; folder !== dirname(folder); folder = dirname(folder)) {
    const found = await installedVersion(folder, name).catch(() => undefined);
    if (found !== undefined) return found;
  }
  return "unknown";
};

/**
 * Prepares the tools on a real library: Forgebook beside its stories, and its own Storybook.
 *
 * @param request - the benchmark.
 * @param real - the library.
 * @param prepared - what to fill.
 * @returns the id of the story measured.
 */
export const prepareReal = async (
  request: PrepareRequest,
  { corpus, paths }: RealRun,
  prepared: PreparedRun
): Promise<string> => {
  const { folders, io, forgebookPackages: packages, targets } = request;
  await prepareCorpus(
    { corpus, paths, packages, repository: folders.repository, onActivity: request.onActivity },
    io
  );
  for (const { target, port } of withPorts(targets, request.port)) {
    const metrics: Record<string, MetricResult> = {};
    prepared.report[target.name] = metrics;
    const directory =
      target.name === "forgebook" ? paths.bench : join(paths.clone, corpus.storybook?.folder ?? "");
    const named = await Promise.all(
      target.packages.map(async (name) => [name, await resolvedVersion(directory, name)] as const)
    );
    prepared.versions[target.name] = Object.fromEntries(named);
    prepared.tools.push({
      context: {
        target,
        directory,
        buildFolder: join(folders.work, BUILDS_FOLDER, corpus.name, target.name),
        browser: prepared.browser,
        port,
        subject: realSubject(target, corpus, paths),
        throttle: request.throttle,
        io
      },
      metrics
    });
  }
  return corpus.measured.forgebookStory;
};

/**
 * The tools a real library is measured with: Forgebook, and with `--compare` its own Storybook when it can run.
 *
 * @param forgebook - Forgebook, with its frames where the run places them.
 * @param corpus - the library.
 * @param clone - the clone's root.
 * @param isCompared - whether its Storybook is measured too.
 */
export const realTargets = (
  forgebook: Target,
  { storybook }: RealCorpus,
  clone: string,
  isCompared: boolean
): Target[] => [
  forgebook,
  ...(isCompared && storybook !== undefined ? [libraryStorybook(storybook, clone)] : [])
];

/** What a report says of a real corpus. */
export const realCorpusInfo = ({
  name,
  repository,
  commit,
  licence,
  expected
}: RealCorpus): BenchReport["corpus"] => ({
  components: expected.files,
  stories: expected.stories,
  real: { name, repository, commit, licence }
});
