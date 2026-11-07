/**
 * One cell, run for real: the tool's version written into the workspace's overrides, the install, a check that the
 * install put that version in place, then the package's and its fixture's commands. Meant for a disposable checkout
 * (a CI runner): it rewrites the root `package.json` and the lockfile.
 *
 * @module
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { exec } from "@ensiria/cli-kit/exec";
import type { ScriptIo } from "@ensiria/cli-kit/io.types";

import type { CellCommand, CellResult, CompatMatrix, PlannedCell } from "./compat.types.ts";
import { parseManifest } from "./documents.ts";
import { cellCommands, hostOf } from "./plan.ts";

/** How long one command may run before it is stopped: a fixture's build is about a minute on a runner. */
const COMMAND_TIMEOUT_MS = 20 * 60_000;

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The root `package.json` with each package pinned through pnpm's overrides, every other field as it was, so every
 * workspace package and every dependency of theirs installs that one version.
 */
export const withOverrides = (source: string, versions: Readonly<Record<string, string>>): string => {
  const manifest: unknown = JSON.parse(source);
  if (!isRecord(manifest)) throw new Error("the root package.json is not an object");
  const pnpm = isRecord(manifest["pnpm"]) ? manifest["pnpm"] : {};
  const overrides = isRecord(pnpm["overrides"]) ? pnpm["overrides"] : {};
  return `${JSON.stringify({ ...manifest, pnpm: { ...pnpm, overrides: { ...overrides, ...versions } } }, null, 2)}\n`;
};

/**
 * The version of a package the folders resolve, read from the nearest `node_modules/<name>/package.json` above the
 * first folder that has one, as Node would find it from there.
 */
export const installedVersion = (name: string, folders: readonly string[]): string | undefined => {
  for (const start of folders) {
    let folder = start;
    for (;;) {
      const file = join(folder, "node_modules", name, "package.json");
      if (existsSync(file)) {
        const value: unknown = JSON.parse(readFileSync(file, "utf8"));
        return isRecord(value) && typeof value["version"] === "string" ? value["version"] : undefined;
      }
      const parent = dirname(folder);
      if (parent === folder) break;
      folder = parent;
    }
  }
  return undefined;
};

/** The packages whose installed version differs from the one asked for, as `name installed (asked)` lines. */
export const versionMismatches = (
  installed: Readonly<Record<string, string>>,
  asked: Readonly<Record<string, string>>
) =>
  Object.entries(asked)
    .filter(([name, version]) => installed[name] !== version)
    .map(([name, version]) => `${name} ${installed[name] ?? "missing"} (asked ${version})`);

/** A cell's status from its commands: passed only when every one ended with 0. */
export const commandsVerdict = (commands: readonly CellCommand[]): Pick<CellResult, "status" | "reason"> => {
  const failed = commands.filter((command) => command.code !== 0);
  if (failed.length === 0) return { status: "passed" };
  return { status: "failed", reason: `failed: ${failed.map((command) => command.command).join("; ")}` };
};

/**
 * Runs a program, its output on stderr behind a prefix, and resolves to its code and the last line of its stderr;
 * a program that could not start or ran past its time ends with `null`, so it fails the cell instead of the run.
 */
const ended = async (
  [program = "pnpm", ...args]: readonly string[],
  prefix: string,
  cwd: string,
  io: ScriptIo
): Promise<{ code: number | null; last: string }> => {
  try {
    const { code, stderr } = await exec(program, args, {
      cwd,
      io,
      check: false,
      output: "prefix",
      prefix,
      timeoutMs: COMMAND_TIMEOUT_MS
    });
    return { code, last: stderr.trim().split("\n").at(-1) ?? "" };
  } catch (error) {
    return { code: null, last: error instanceof Error ? error.message : String(error) };
  }
};

/** Where the run is: the repository and the tools it uses. */
export type CellContext = {
  /** The repository's root, whose `package.json` and lockfile the cell rewrites. */
  readonly root: string;
  /** The script's io, so its programs print through it and stop with it. */
  readonly io: ScriptIo;
  /** The Node version it runs on, recorded in the result. */
  readonly node: string;
};

/** Runs one cell and resolves to what it found; a failure of the cell is a result, not a thrown error. */
export const runCell = async (
  matrix: CompatMatrix,
  cell: PlannedCell,
  context: CellContext
): Promise<CellResult> => {
  const { root, io, node } = context;
  const adapter = matrix.adapters.find((entry) => entry.name === cell.adapter);
  if (adapter === undefined) throw new Error(`the matrix has no package ${cell.adapter}`);
  const host = hostOf(matrix, cell.host);
  const asked = cell.packages;
  const missing = host.packages.filter((name) => asked[name] === undefined);
  if (missing.length > 0) throw new Error(`the cell pins no version of ${missing.join(", ")}`);
  const rootManifest = join(root, "package.json");
  writeFileSync(rootManifest, withOverrides(readFileSync(rootManifest, "utf8"), asked));

  const notRun = (reason: string, installed: Record<string, string> = {}): CellResult => ({
    ...cell,
    status: "not-run",
    reason,
    installed,
    commands: [],
    node
  });

  const install = await ended(["pnpm", "install", "--no-frozen-lockfile"], "install", root, io);
  // the reason stays the same from run to run, so a failing install opens no new pull request each week; what
  // pnpm printed is in the run's log
  if (install.code !== 0) {
    io.stderr.write(`install failed: ${install.last}\n`);
    return notRun("the install failed");
  }

  const folders = [join(root, adapter.folder), join(root, adapter.fixture)];
  const installed = Object.fromEntries(
    host.packages.flatMap((name) => {
      const version = installedVersion(name, folders);
      return version === undefined ? [] : [[name, version]];
    })
  );
  const mismatches = versionMismatches(installed, asked);
  if (mismatches.length > 0)
    return notRun(`the install did not put the version in place: ${mismatches.join(", ")}`, installed);

  const adapterManifest = parseManifest(
    readFileSync(join(root, adapter.folder, "package.json"), "utf8"),
    adapter.folder
  );
  const fixtureManifest = parseManifest(
    readFileSync(join(root, adapter.fixture, "package.json"), "utf8"),
    adapter.fixture
  );
  const planned = cellCommands(adapterManifest, fixtureManifest);
  if (planned.length === 0)
    return notRun("the package and its fixture have no test or build to run", installed);
  const commands: CellCommand[] = [];
  for (const command of planned) {
    const { code } = await ended(command, command.slice(-2).join(" "), root, io);
    commands.push({ command: command.join(" "), code });
  }
  return { ...cell, ...commandsVerdict(commands), installed, commands, node };
};
