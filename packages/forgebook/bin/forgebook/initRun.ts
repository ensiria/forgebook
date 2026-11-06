/**
 * What `forgebook init` does: chooses the route (the project's Storybook, or its dependencies), refuses what it must not
 * do, writes the files, and reports what is left.
 *
 * @remarks
 * Non-interactive on purpose, so an agent can run it: a question it cannot answer is a refusal that names what to pass.
 * Every refusal happens before the first write. Reading a Storybook loads its `main`, which runs the project's code, so
 * a project on Storybook is told to choose rather than having it run unasked: an agent may be in a project it did not
 * write. Both routes answer with the same document, and a refusal is a document too under `--json` (`refused` tells them
 * apart), since an agent reads stdout. A file at a written path that is a link is refused even with `--force`: writing
 * through it would change a file elsewhere.
 *
 * @module
 */
import { existsSync, lstatSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { EXIT } from "@ensiria/cli-kit/constants";
import { exec } from "@ensiria/cli-kit/exec";
import { formatJson } from "@ensiria/cli-kit/files";
import type { ScriptIo } from "@ensiria/cli-kit/io.types";
import type { Logger } from "@ensiria/cli-kit/log.types";
import { ScriptError } from "@ensiria/cli-kit/script";

import { CONFIG_FILES, PREVIEW_FILES } from "../../src/vite/configFile.ts";
import {
  findStorybookDir,
  type ImportedConfig,
  importStorybook,
  projectManifest
} from "./importers/storybook.ts";
import { frameworkPeers, type ImportedFramework } from "./importers/storybookFrameworks.ts";
import { CONFIG_FILE, initConfigText } from "./initConfig.ts";
import { planNewProject } from "./newProject/newProject.ts";
import type {
  InitCommand,
  InitDocument,
  InitInstall,
  InitRefusal,
  InitRoute,
  NextStep
} from "./newProject/newProject.types.ts";
import {
  type DetectedPackageManager,
  detectPackageManager,
  forgebookRunner,
  installArguments,
  spawnedCommand,
  workspaceRootFlags
} from "./newProject/packageManagers.ts";
import { printable } from "./newProject/projectEntries.ts";
import { detectFramework, FRAMEWORK_NAMES, PROJECT_FRAMEWORKS } from "./newProject/projectFrameworks.ts";
import {
  declaredPackages,
  installSpecifier,
  type PackageState,
  packageState,
  requiredPackages
} from "./newProject/projectPackages.ts";

/** What the command was given. */
export type InitRequest = {
  /** `--from`. */
  readonly from: string | undefined;
  /** `--framework`. */
  readonly framework: string | undefined;
  /** `--force`. */
  readonly isForced: boolean;
  /** `--install`. */
  readonly shouldInstall: boolean;
};

/** Where the command prints. */
export type InitContext = {
  /** The run's streams. */
  readonly io: ScriptIo;
  /** The run's logger. */
  readonly log: Logger;
  /** Whether stdout carries JSON. */
  readonly isJson: boolean;
};

/** What a route will write. */
type InitPlan = {
  /** The route taken. */
  readonly route: InitRoute;
  /** The configuration, as the writer takes it. */
  readonly config: ImportedConfig;
  /** The tool the configuration is read from, for its comment; none for the dependencies. */
  readonly tool: string | undefined;
  /** The preview to write. */
  readonly preview: { readonly file: string; readonly text: string } | undefined;
  /** What was left to do. */
  readonly nextSteps: readonly NextStep[];
  /** The packages the project's setup asks for, beyond the adapter's. */
  readonly extraPeers: readonly string[];
};

/** A refusal's document without what is always the same. */
type Refusal = Pick<InitRefusal, "refused" | "message"> & Partial<InitRefusal>;

/**
 * Stops the command: its document on stdout under `--json`, the error otherwise. Never returns.
 *
 * @param refusal - why.
 * @param context - where it prints.
 */
const refuse = (refusal: Refusal, context: InitContext): never => {
  const message = printable(refusal.message);
  const document: InitRefusal = {
    schema: 1,
    hint: undefined,
    supported: undefined,
    concerned: undefined,
    ...refusal,
    message
  };
  if (context.isJson) context.io.stdout.write(formatJson(document));
  throw new ScriptError(message, { hint: refusal.hint, isReported: context.isJson });
};

/**
 * The framework a project starts from: the one asked for, else the one its dependencies name.
 *
 * @param projectDir - the project's folder.
 * @param asked - `--framework`.
 * @param context - where a refusal prints.
 */
const frameworkOf = (
  projectDir: string,
  asked: string | undefined,
  context: InitContext
): ImportedFramework => {
  const supported = FRAMEWORK_NAMES.join(", ");
  const named = FRAMEWORK_NAMES.find((name) => name === asked);
  if (named !== undefined) return named;
  if (!existsSync(join(projectDir, "package.json")))
    return refuse(
      {
        refused: "no-package",
        message: "No package.json here, so no framework can be read",
        hint: "Run forgebook init in the folder of the package that holds the components"
      },
      context
    );
  const detection = detectFramework(declaredPackages(projectDir));
  if (detection.kind === "found") return detection.framework;
  if (detection.kind === "ambiguous")
    return refuse(
      {
        refused: "ambiguous-framework",
        message: `package.json names several frameworks: ${detection.candidates.join(", ")}`,
        hint: `Choose the stories' with --framework <name> (${supported})`,
        supported: FRAMEWORK_NAMES,
        concerned: detection.candidates
      },
      context
    );
  return refuse(
    {
      refused: "unknown-framework",
      message: `package.json names no framework Forgebook supports. Supported: ${supported}`,
      hint: "In a workspace, run it in the package that holds the components; otherwise name one with --framework <name> (html for no framework)",
      supported: FRAMEWORK_NAMES
    },
    context
  );
};

/** The plan of the Storybook route. */
const storybookPlan = async (projectDir: string, context: InitContext): Promise<InitPlan> => {
  const imported = await importStorybook(projectDir);
  if (typeof imported === "string") return refuse({ refused: "storybook", message: imported }, context);
  return {
    route: "storybook",
    config: imported,
    tool: "Storybook",
    preview: undefined,
    nextSteps: imported.notes.map((message) => ({ kind: "storybook", file: undefined, message })),
    extraPeers: []
  };
};

/** The sentence and the document's entry for packages too old, on the route that goes on regardless. */
const tooOldText = ({ tooOld }: PackageState): string =>
  tooOld.map(({ name, found, floor }) => `${name} ${found} is below ${floor}`).join(", ");

/** The commands to run next. */
const nextCommands = (
  runner: string,
  install: InitInstall,
  framework: ImportedFramework
): readonly InitCommand[] => [
  ...(install.command === undefined || install.status === "ran"
    ? []
    : [
        {
          command: install.command,
          description: "Install what the configuration imports.",
          placeholder: undefined
        }
      ]),
  {
    command: `${runner} new <component file>`,
    description: `Write a component's first stories (${PROJECT_FRAMEWORKS[framework].label}).`,
    placeholder: "<component file>"
  },
  { command: `${runner} dev`, description: "Open the catalogue.", placeholder: undefined },
  {
    command: `${runner} stories --json`,
    description: "List the stories, and what did not read.",
    placeholder: undefined
  },
  {
    command: `${runner} agents`,
    description: "Tell the project's coding agents about the catalogue.",
    placeholder: undefined
  }
];

/** Runs the install command, the program's lines on stderr so stdout stays the result's. */
const runInstall = async (
  projectDir: string,
  manager: DetectedPackageManager,
  args: readonly string[],
  io: ScriptIo
): Promise<string | undefined> => {
  const { program, args: spawnArgs, env } = spawnedCommand(manager.name, args, io.env);
  try {
    await exec(program, spawnArgs, { cwd: projectDir, env, output: "prefix", prefix: manager.name, io });
    return undefined;
  } catch (error) {
    if (error instanceof ScriptError) return error.message;
    throw error;
  }
};

/** Prints the outcome: the document under `--json`, sentences for a person otherwise. */
const print = (document: InitDocument, { io, log, isJson }: InitContext): void => {
  if (isJson) {
    io.stdout.write(formatJson(document));
    return;
  }
  const { detectedFrom, name } = document.packageManager;
  if (document.route === "new-project") {
    const from = detectedFrom === undefined ? "no lock file: assumed" : detectedFrom;
    log.success(`${PROJECT_FRAMEWORKS[document.framework].label} project, ${name} (${from})`);
  }
  const count = document.stories.length;
  log.success(`${CONFIG_FILE} written: ${count} story ${count === 1 ? "glob" : "globs"}`);
  for (const file of document.written.slice(1)) log.success(`${file} written`);
  for (const step of document.nextSteps) log.warn(step.message);
  for (const { command, description } of document.commands) log.info(`${command}: ${description}`);
};

/**
 * The plan of the route the command takes.
 *
 * @param projectDir - the project's folder.
 * @param request - what the command was given.
 * @param context - where it prints.
 */
const planOf = async (projectDir: string, request: InitRequest, context: InitContext): Promise<InitPlan> => {
  if (request.from === "storybook") return storybookPlan(projectDir, context);
  const storybookDir = findStorybookDir(projectDir);
  if (request.framework === undefined && storybookDir !== undefined) {
    const folder = basename(storybookDir);
    return refuse(
      {
        refused: "storybook-found",
        message: `This project is on Storybook (${folder}): its files say more than package.json does`,
        hint: `--from storybook reads them, which loads ${folder}/main and so runs its code; --framework <name> starts from the dependencies instead`,
        supported: FRAMEWORK_NAMES,
        concerned: [folder]
      },
      context
    );
  }
  const framework = frameworkOf(projectDir, request.framework, context);
  const made = planNewProject(projectDir, framework);
  return {
    route: "new-project",
    tool: undefined,
    config: {
      framework,
      frameworkOptions: made.frameworkOptions,
      title: made.title,
      stories: made.stories,
      preview: undefined,
      switches: undefined,
      notes: []
    },
    preview: made.preview,
    nextSteps: made.nextSteps,
    extraPeers: made.extraPeers
  };
};

/** Whether a path holds anything, a dangling link included. */
const isThere = (path: string): boolean => lstatSync(path, { throwIfNoEntry: false }) !== undefined;

/**
 * Refuses a file the catalogue reads that is there already, unless asked to replace it, and a link at any time.
 *
 * @param projectDir - the project's folder.
 * @param name - the file found; none when there is none.
 * @param isForced - `--force`.
 * @param context - where a refusal prints.
 */
const refuseExisting = (
  projectDir: string,
  name: string | undefined,
  isForced: boolean,
  context: InitContext
): void => {
  if (name === undefined) return;
  if (lstatSync(join(projectDir, name)).isSymbolicLink())
    refuse(
      {
        refused: "symlink",
        message: `${name} is a link: writing through it would change a file elsewhere`,
        hint: "Remove the link, then run forgebook init again",
        concerned: [name]
      },
      context
    );
  if (isForced) return;
  refuse(
    {
      refused: "existing-files",
      message: `${name} is already there`,
      hint: "Give --force to replace it",
      concerned: [name]
    },
    context
  );
};

/** The step for a file of another name left behind: the catalogue now reads the one written. */
const shadowedStep = (shadowed: string | undefined, written: string | undefined): readonly NextStep[] =>
  shadowed === undefined || written === undefined || shadowed === written
    ? []
    : [
        {
          kind: "setup",
          file: shadowed,
          message: `${shadowed} is still there and is no longer read: move what it holds to ${written}, then remove it`
        }
      ];

/** The install's state, from what is needed, what was asked and how it went. */
const installStatus = (
  needsInstall: boolean,
  shouldInstall: boolean,
  failure: string | undefined
): InitInstall["status"] => {
  if (!needsInstall) return "not-needed";
  if (!shouldInstall) return "to-run";
  return failure === undefined ? "ran" : "failed";
};

/**
 * Stops on a `package.json` that cannot be parsed: everything after this reads it.
 *
 * @param projectDir - the project's folder.
 * @param context - where a refusal prints.
 */
const refuseBrokenManifest = (projectDir: string, context: InitContext): void => {
  try {
    projectManifest(projectDir);
  } catch (error) {
    refuse(
      {
        refused: "unreadable-package",
        message: `package.json cannot be read: ${error instanceof Error ? error.message : String(error)}`
      },
      context
    );
  }
};

/** Writes the plan's files: a file is replaced only when one was found and `--force` allowed it. */
const writePlan = (
  projectDir: string,
  plan: InitPlan,
  previewFile: string | undefined,
  replaced: readonly string[]
): void => {
  const write = (name: string, text: string): void =>
    writeFileSync(join(projectDir, name), text, { flag: replaced.includes(name) ? "w" : "wx" });
  write(CONFIG_FILE, initConfigText(plan.config, plan.tool));
  if (plan.preview !== undefined && previewFile !== undefined) write(previewFile, plan.preview.text);
};

/** What the configuration needs installed: the command, run when asked. */
const settleInstall = async (
  projectDir: string,
  manager: DetectedPackageManager,
  state: PackageState,
  declared: ReadonlyMap<string, string>,
  shouldInstall: boolean,
  io: ScriptIo
): Promise<InitInstall> => {
  const needsInstall = state.missing.length > 0 || state.hasUninstalled;
  const args = installArguments(
    manager.name,
    state.missing.map((name) => installSpecifier(name, declared)),
    workspaceRootFlags(manager.name, projectDir)
  );
  const failure = needsInstall && shouldInstall ? await runInstall(projectDir, manager, args, io) : undefined;
  return {
    missing: state.missing,
    command: needsInstall ? [manager.name, ...args].join(" ") : undefined,
    status: installStatus(needsInstall, shouldInstall, failure),
    error: failure === undefined ? undefined : printable(failure)
  };
};

/** Refuses what the project has too old for a new catalogue to draw. */
const refuseTooOld = (state: PackageState, context: InitContext): void => {
  if (state.tooOld.length === 0) return;
  refuse(
    {
      refused: "versions",
      message: `Forgebook cannot draw this project yet: ${tooOldText(state)}`,
      hint: "Upgrade them, then run forgebook init again. Nothing was written",
      concerned: state.tooOld.map(({ name }) => name)
    },
    context
  );
};

/** Does the work of `runInit`. */
const initProject = async (request: InitRequest, context: InitContext): Promise<void> => {
  const { io } = context;
  const projectDir = process.cwd();
  if (request.from !== undefined && request.framework !== undefined)
    throw new ScriptError("--from and --framework choose two different routes: give one", {
      exitCode: EXIT.usage
    });
  // any configuration the catalogue would read, not only the file written: a new .ts would win over a .mts
  const existing = CONFIG_FILES.find((name) => isThere(join(projectDir, name)));
  refuseExisting(projectDir, existing, request.isForced, context);
  refuseBrokenManifest(projectDir, context);
  const plan = await planOf(projectDir, request, context);
  const { framework, frameworkOptions } = plan.config;
  const declared = declaredPackages(projectDir);
  const state = packageState(
    projectDir,
    declared,
    requiredPackages(framework, [...frameworkPeers(framework, frameworkOptions), ...plan.extraPeers])
  );
  if (plan.route === "new-project") refuseTooOld(state, context);
  const previewClash = PREVIEW_FILES.find((name) => isThere(join(projectDir, name)));
  if (plan.preview !== undefined) refuseExisting(projectDir, previewClash, request.isForced, context);
  // the first of the names is the one read, so a preview replaced keeps the name it has
  const previewFile = plan.preview === undefined ? undefined : (previewClash ?? plan.preview.file);
  const replaced = [
    ...(existing === CONFIG_FILE ? [CONFIG_FILE] : []),
    ...(previewFile !== undefined && previewFile === previewClash ? [previewFile] : [])
  ];
  writePlan(projectDir, plan, previewFile, replaced);
  const nextSteps: readonly NextStep[] = [
    ...plan.nextSteps,
    ...(state.tooOld.length === 0
      ? []
      : [{ kind: "version" as const, file: "package.json", message: `Upgrade: ${tooOldText(state)}` }]),
    ...shadowedStep(existing, CONFIG_FILE)
  ].map((step) => ({ ...step, message: printable(step.message) }));
  const manager = detectPackageManager(projectDir);
  const install = await settleInstall(projectDir, manager, state, declared, request.shouldInstall, io);
  print(
    {
      schema: 1,
      route: plan.route,
      framework,
      packageManager: { name: manager.name, detectedFrom: manager.detectedFrom },
      written: [CONFIG_FILE, ...(previewFile === undefined ? [] : [previewFile])],
      replaced,
      stories: plan.config.stories,
      install,
      nextSteps,
      commands: nextCommands(forgebookRunner(manager.name), install, framework)
    },
    context
  );
  if (install.error !== undefined)
    throw new ScriptError(install.error, {
      hint: `Run it yourself: ${install.command}`,
      isReported: context.isJson
    });
};

/**
 * Runs `forgebook init`.
 *
 * @param request - what the command was given.
 * @param context - where it prints.
 * @throws a `ScriptError` when it refuses, or the install fails.
 */
export const runInit = async (request: InitRequest, context: InitContext): Promise<void> => {
  try {
    await initProject(request, context);
  } catch (error) {
    if (error instanceof ScriptError) throw error;
    // a file that cannot be read or written: an agent reading stdout gets a document for it too
    refuse({ refused: "failed", message: error instanceof Error ? error.message : String(error) }, context);
  }
};
