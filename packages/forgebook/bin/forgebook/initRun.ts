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
import { existsSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { EXIT } from "@ensiria/cli-kit/constants";
import { ScriptError } from "@ensiria/cli-kit/script";

import { CONFIG_FILES, PREVIEW_FILES } from "../../src/vite/configFile.ts";
import { projectFrameworks } from "./agentGuide.ts";
import { HOOK_NAMES } from "./agentSetup/hookNames.ts";
import { type AgentSteps, runAgentSteps } from "./agentSetup/initAgentSteps.ts";
import { appBuildPlan } from "./appBuild/appBuild.ts";
import { findStorybookDir, type ImportedConfig, importStorybook } from "./importers/storybook.ts";
import { frameworkPeers, type ImportedFramework } from "./importers/storybookFrameworks.ts";
import { CONFIG_FILE, initConfigText } from "./initConfig.ts";
import { settleInstall } from "./initInstall.ts";
import { printInit } from "./initPrint.ts";
import {
  type InitContext,
  isThere,
  refuse,
  refuseBrokenManifest,
  refuseExisting,
  refuseTooOld,
  tooOldText
} from "./initRefusals.ts";
import { planNewProject } from "./newProject/newProject.ts";
import type { InitCommand, InitInstall, InitRoute, NextStep } from "./newProject/newProject.types.ts";
import { detectPackageManager, forgebookRunner } from "./newProject/packageManagers.ts";
import { printable } from "./newProject/projectEntries.ts";
import { detectFramework, FRAMEWORK_NAMES, PROJECT_FRAMEWORKS } from "./newProject/projectFrameworks.ts";
import { declaredPackages, packageState, requiredPackages } from "./newProject/projectPackages.ts";

/** What a browser's checks need besides the catalogue's own packages. */
const TESTING_PACKAGES = ["@forgebook/testing", "@playwright/test"];

/** What the command was given. */
export type InitRequest = {
  /** `--from`. */
  readonly from: string | undefined;
  /** `--framework`. */
  readonly framework: string | undefined;
  /** `--force`. */
  readonly isForced: boolean;
  /** `--install`, or `--browser`, which needs it. */
  readonly shouldInstall: boolean;
  /** `--agents`. */
  readonly isForAgents: boolean;
  /** `--hooks`. */
  readonly hooks: readonly string[] | undefined;
  /** `--browser`. */
  readonly shouldInstallBrowser: boolean;
  /** `--draw`. */
  readonly shouldDraw: boolean;
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
  // an agent's setup runs beside a Storybook, on the same stories, and loads nothing of it
  if (request.framework === undefined && storybookDir !== undefined && !request.isForAgents) {
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

/** Writes the plan's files: a file is replaced only when one was found and `--force` allowed it. */
const writePlan = (
  projectDir: string,
  plan: InitPlan,
  previewFile: string | undefined,
  replaced: readonly string[],
  keepsCatalogue: boolean
): void => {
  const write = (name: string, text: string): void =>
    writeFileSync(join(projectDir, name), text, { flag: replaced.includes(name) ? "w" : "wx" });
  if (!keepsCatalogue) write(CONFIG_FILE, initConfigText(plan.config, plan.tool));
  if (plan.preview !== undefined && previewFile !== undefined) write(previewFile, plan.preview.text);
};

/** Stops on options that cannot go together, which is a wrong command line and no document. */
const refuseWrongOptions = ({ from, framework, hooks, isForAgents }: InitRequest): void => {
  if (from !== undefined && framework !== undefined)
    throw new ScriptError("--from and --framework choose two different routes: give one", {
      exitCode: EXIT.usage
    });
  if (hooks === undefined) return;
  if (!isForAgents) throw new ScriptError("--hooks goes with --agents", { exitCode: EXIT.usage });
  const unknown = hooks.filter((name) => !HOOK_NAMES.includes(name));
  if (unknown.length > 0)
    throw new ScriptError(`--hooks has no ${unknown.join(", ")}`, {
      hint: `It takes ${HOOK_NAMES.join(", ")}`,
      exitCode: EXIT.usage
    });
};

/** A configuration the catalogue would read, and whether this run keeps it. */
type ExistingCatalogue = { readonly file: string | undefined; readonly isKept: boolean };

/**
 * The configuration already there: any the catalogue would read, not only the file written, as a new `.ts` would win over
 * a `.mts`. Set up again, or added to a catalogue a person wrote, `--agents` keeps it; otherwise it is a refusal.
 */
const existingCatalogue = (
  projectDir: string,
  request: InitRequest,
  context: InitContext
): ExistingCatalogue => {
  const file = CONFIG_FILES.find((name) => isThere(join(projectDir, name)));
  const isKept = request.isForAgents && !request.isForced && file !== undefined;
  if (!isKept) refuseExisting(projectDir, file, request.isForced, context);
  return { file, isKept };
};

/** The request with the framework a kept catalogue names: its adapter says more than the dependencies do. */
const withKeptFramework = (
  projectDir: string,
  request: InitRequest,
  { file, isKept }: ExistingCatalogue
): InitRequest =>
  isKept && file !== undefined
    ? { ...request, framework: request.framework ?? projectFrameworks(join(projectDir, file), projectDir)[0] }
    : request;

/** The preview to write, and the one found there; a run for agents keeps one found. */
const choosePreview = (
  projectDir: string,
  plan: InitPlan,
  request: InitRequest,
  keepsCatalogue: boolean,
  context: InitContext
): { readonly previewFile: string | undefined; readonly previewClash: string | undefined } => {
  const previewClash = PREVIEW_FILES.find((name) => isThere(join(projectDir, name)));
  // a catalogue kept keeps its look too: a preview here would load for every story of a catalogue that has none on purpose
  const isKept = request.isForAgents && !request.isForced && (previewClash !== undefined || keepsCatalogue);
  if (plan.preview !== undefined && !isKept)
    refuseExisting(projectDir, previewClash, request.isForced, context);
  // the first of the names is the one read, so a preview replaced keeps the name it has
  return {
    previewFile: plan.preview === undefined || isKept ? undefined : (previewClash ?? plan.preview.file),
    previewClash
  };
};

/** Fails the command on what did not work: the document has said so already under `--json`. */
const stopOnFailure = (install: InitInstall, steps: AgentSteps, { isJson }: InitContext): void => {
  if (install.error !== undefined)
    throw new ScriptError(install.error, {
      hint: `Run it yourself: ${install.command}`,
      isReported: isJson
    });
  if (steps.browser?.status === "failed")
    throw new ScriptError(steps.browser.error ?? "The browser did not install", { isReported: isJson });
  if (steps.draw !== undefined && steps.draw.status !== "drawn")
    throw new ScriptError(steps.draw.stoppedBecause ?? "No story drew", { isReported: isJson });
};

/** Does the work of `runInit`. */
const initProject = async (request: InitRequest, context: InitContext): Promise<void> => {
  const { io } = context;
  const projectDir = process.cwd();
  refuseWrongOptions(request);
  const existing = existingCatalogue(projectDir, request, context);
  refuseBrokenManifest(projectDir, context);
  const plan = await planOf(projectDir, withKeptFramework(projectDir, request, existing), context);
  const { framework, frameworkOptions } = plan.config;
  const declared = declaredPackages(projectDir);
  const state = packageState(
    projectDir,
    declared,
    requiredPackages(framework, [
      ...frameworkPeers(framework, frameworkOptions),
      ...plan.extraPeers,
      // the workflow's and the hook's `verify` runs stories through it, so agents' setup asks for it, whether or not it installs
      ...(request.shouldInstallBrowser || request.isForAgents ? TESTING_PACKAGES : [])
    ])
  );
  if (plan.route === "new-project") refuseTooOld(state, context);
  const { previewFile, previewClash } = choosePreview(projectDir, plan, request, existing.isKept, context);
  const replaced = [
    ...(existing.file === CONFIG_FILE && !existing.isKept ? [CONFIG_FILE] : []),
    ...(previewFile !== undefined && previewFile === previewClash ? [previewFile] : [])
  ];
  writePlan(projectDir, plan, previewFile, replaced, existing.isKept);
  const nextSteps: readonly NextStep[] = [
    ...plan.nextSteps,
    ...(state.tooOld.length === 0
      ? []
      : [{ kind: "version" as const, file: "package.json", message: `Upgrade: ${tooOldText(state)}` }]),
    ...(existing.isKept ? [] : shadowedStep(existing.file, CONFIG_FILE))
  ].map((step) => ({ ...step, message: printable(step.message) }));
  const manager = detectPackageManager(projectDir);
  const install = await settleInstall(projectDir, manager, state, declared, request.shouldInstall, io);
  const steps = await runAgentSteps(
    {
      projectDir,
      framework,
      manager: manager.name,
      install,
      isForAgents: request.isForAgents,
      hooks: request.hooks,
      shouldInstallBrowser: request.shouldInstallBrowser,
      shouldDraw: request.shouldDraw,
      stories: existing.isKept ? undefined : plan.config.stories
    },
    io
  );
  printInit(
    {
      schema: 1,
      route: plan.route,
      framework,
      packageManager: { name: manager.name, detectedFrom: manager.detectedFrom },
      written: [
        ...(existing.isKept ? [] : [CONFIG_FILE]),
        ...(previewFile === undefined ? [] : [previewFile])
      ],
      replaced,
      stories: existing.isKept ? [] : plan.config.stories,
      install,
      appBuild: appBuildPlan(projectDir, framework),
      nextSteps: [...nextSteps, ...(steps.agents?.nextSteps ?? [])],
      commands: nextCommands(forgebookRunner(manager.name), install, framework),
      ...steps
    },
    context
  );
  stopOnFailure(install, steps, context);
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
