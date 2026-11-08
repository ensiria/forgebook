/**
 * What `forgebook init` needs installed, and the install when it is asked for: what a failed one said, and a second try
 * on the peer conflicts npm stops on.
 *
 * @module
 */
import { exec } from "@ensiria/cli-kit/exec";
import type { ScriptIo } from "@ensiria/cli-kit/io.types";
import { ScriptError } from "@ensiria/cli-kit/script";

import { printable } from "../../src/printable.ts";
import type { InitInstall } from "./newProject/newProject.types.ts";
import {
  type DetectedPackageManager,
  installArguments,
  spawnedCommand,
  workspaceRootFlags
} from "./newProject/packageManagers.ts";
import { installSpecifier, type PackageState } from "./newProject/projectPackages.ts";

/** How much of a failed install's end is kept: enough for its reason, not to flood an agent's context. */
const INSTALL_LINES = 12;

/** The same, in characters. */
const INSTALL_TEXT = 360;

/** The end of what an install said: why it failed is in its last lines, not in its exit code. */
const installFailure = (command: string, code: number | null, said: string): string => {
  const lines = said.split("\n").filter((line) => /\S/.test(line));
  const errorCode = said.match(/\bE[A-Z]{5,}\b/)?.[0];
  return `${command} exited with code ${code ?? "none"}${errorCode === undefined ? "" : ` (${errorCode})`}: ${lines.slice(-INSTALL_LINES).join("\n").slice(-INSTALL_TEXT)}`;
};

/** Runs the install command, the program's lines on stderr so stdout stays the result's. */
const runInstall = async (
  projectDir: string,
  manager: DetectedPackageManager,
  args: readonly string[],
  io: ScriptIo
): Promise<string | undefined> => {
  const { program, args: spawnArgs, env } = spawnedCommand(manager.name, args, io.env);
  try {
    const { code, stdout, stderr } = await exec(program, spawnArgs, {
      cwd: projectDir,
      env,
      output: "prefix",
      prefix: manager.name,
      io,
      check: false
    });
    return code === 0
      ? undefined
      : installFailure(`${manager.name} ${args.join(" ")}`, code, `${stdout}\n${stderr}`);
  } catch (error) {
    if (error instanceof ScriptError) return error.message;
    throw error;
  }
};

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
 * What the configuration needs installed: the command, run when asked.
 *
 * @param projectDir - the project's folder.
 * @param manager - its package manager.
 * @param state - what it has of the packages.
 * @param declared - what it declares.
 * @param shouldInstall - whether to run the command.
 * @param io - the run's streams.
 */
export const settleInstall = async (
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
  const first = needsInstall && shouldInstall ? await runInstall(projectDir, manager, args, io) : undefined;
  // npm stops on any peer conflict in the whole tree, often the project's own and older than this run: these packages
  // install beside it either way, and the conflict stays the project's to settle
  const isPeerConflict = manager.name === "npm" && first?.includes("ERESOLVE") === true;
  const finalArgs = isPeerConflict ? [...args, "--legacy-peer-deps"] : args;
  const failure = isPeerConflict ? await runInstall(projectDir, manager, finalArgs, io) : first;
  return {
    missing: state.missing,
    command: needsInstall ? [manager.name, ...finalArgs].join(" ") : undefined,
    status: installStatus(needsInstall, shouldInstall, failure),
    error: failure === undefined ? undefined : printable(failure)
  };
};
