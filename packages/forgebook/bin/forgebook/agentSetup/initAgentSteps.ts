/**
 * What `forgebook init` does after the catalogue's own files, when asked: sets up the project's coding agents, installs the
 * browser, and draws a story.
 *
 * @remarks
 * Each is asked for by name, since each does more than write a catalogue's files: the browser is a large download, and
 * drawing runs the project's code. A step that cannot go on is reported in the document and the next is still tried when
 * it does not depend on it, so one run says everything that is wrong.
 *
 * @module
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ScriptIo } from "@ensiria/cli-kit/io.types";

import { installBrowser } from "../browserRun.ts";
import type { InitInstall, PackageManagerName } from "../newProject/newProject.types.ts";
import { type AgentFiles, writeAgentFiles } from "./agentFiles.ts";
import { storyFolders } from "./drawCandidates.ts";
import { type DrawResult, prepareGenerated, projectForgebook, runDraw } from "./drawRun.ts";
import { liftedProviders } from "./liftedProviders.ts";

/** What came of installing the browser. */
export type BrowserStep = {
  /** Whether it ran. */
  readonly status: "ran" | "failed";
  /** Why it failed. */
  readonly error: string | undefined;
};

/** What the steps were given. */
export type AgentStepsRequest = {
  /** The project's folder. */
  readonly projectDir: string;
  /** The adapter's name. */
  readonly framework: string;
  /** The package manager. */
  readonly manager: PackageManagerName;
  /** How the install went. */
  readonly install: InitInstall;
  /** `--agents`. */
  readonly isForAgents: boolean;
  /** `--hooks`. */
  readonly hooks: readonly string[] | undefined;
  /** `--browser`. */
  readonly shouldInstallBrowser: boolean;
  /** `--draw`. */
  readonly shouldDraw: boolean;
  /** The story patterns written, so only a component whose stories the catalogue lists is tried; none for a catalogue kept. */
  readonly stories: readonly string[] | undefined;
};

/** What came of the steps; a step not asked for is absent. */
export type AgentSteps = {
  /** The files written for the agents. */
  readonly agents?: AgentFiles;
  /** The browser. */
  readonly browser?: BrowserStep;
  /** The drawing. */
  readonly draw?: DrawResult;
};

/** The drawing, when what it needs is not there: the first thing to do about it. */
const cannotDraw = (reason: string): DrawResult => ({
  status: "not-run",
  story: undefined,
  storyFile: undefined,
  isWritten: false,
  picture: undefined,
  attempts: [],
  stoppedBecause: reason
});

/** Installs the browser, its lines kept off stdout. */
const browserStep = async (projectDir: string, io: ScriptIo): Promise<BrowserStep> => {
  try {
    await installBrowser(projectDir, false, io);
    return { status: "ran", error: undefined };
  } catch (error) {
    return { status: "failed", error: (error instanceof Error ? error.message : String(error)).slice(-400) };
  }
};

/**
 * Writes the providers of a React app's entry into the catalogue's preview.
 *
 * @param projectDir - the project's folder.
 * @returns their names and how to take them out; none when the entry has none a copy can give.
 */
const liftEntryProviders = (
  projectDir: string
): { readonly names: readonly string[]; readonly undo: () => void } | undefined => {
  const entry = ["src/main", "src/index", "src/client", "index"]
    .flatMap((name) => ["tsx", "jsx"].map((extension) => join(projectDir, `${name}.${extension}`)))
    .find((file) => existsSync(file));
  if (entry === undefined) return undefined;
  const previewFile = join(projectDir, "forgebook.preview.tsx");
  const before = existsSync(previewFile) ? readFileSync(previewFile, "utf8") : undefined;
  const lifted = liftedProviders(readFileSync(entry, "utf8"), entry, previewFile, before ?? "");
  if (lifted === undefined) return undefined;
  writeFileSync(previewFile, lifted.preview);
  return {
    names: lifted.names,
    undo: () => {
      if (before === undefined) rmSync(previewFile, { force: true });
      else writeFileSync(previewFile, before);
    }
  };
};

/** Draws, when what it needs is there. */
const drawStep = (
  install: InitInstall,
  browser: BrowserStep | undefined,
  draw: () => Promise<DrawResult>
): Promise<DrawResult> => {
  if (install.status !== "ran" && install.status !== "not-needed")
    return Promise.resolve(
      cannotDraw(`The packages are not installed: ${install.command ?? "install them"}, or give --install`)
    );
  return browser?.status === "failed" ? Promise.resolve(cannotDraw("The browser did not install")) : draw();
};

/**
 * Runs the steps asked for.
 *
 * @param request - what they were given.
 * @param io - the run's streams.
 */
export const runAgentSteps = async (request: AgentStepsRequest, io: ScriptIo): Promise<AgentSteps> => {
  const { projectDir, framework, manager, install } = request;
  const run = projectForgebook(projectDir, io.env);
  const agents = request.isForAgents
    ? writeAgentFiles({ projectDir, framework, manager, hooks: request.hooks })
    : undefined;
  const isInstalled = install.status === "ran" || install.status === "not-needed";
  const browser = request.shouldInstallBrowser && isInstalled ? await browserStep(projectDir, io) : undefined;
  const draw = request.shouldDraw
    ? await drawStep(install, browser, () =>
        runDraw({
          dir: projectDir,
          framework,
          run,
          prepare: () => prepareGenerated(projectDir, framework, io.env),
          ...(framework === "react" && request.stories !== undefined
            ? { liftProviders: () => liftEntryProviders(projectDir) }
            : {}),
          folders: storyFolders(request.stories ?? [])
        })
      )
    : undefined;
  return {
    ...(agents === undefined ? {} : { agents }),
    ...(browser === undefined ? {} : { browser }),
    ...(draw === undefined ? {} : { draw })
  };
};
