/**
 * How a program is started on each system: as named on macOS and Linux; on Windows, a package's command is a `.cmd`
 * shim, which is read so its script runs with Node directly.
 *
 * @remarks
 * Node refuses to spawn a `.cmd` or a `.bat` without a shell, and through `cmd.exe` every argument would need quoting
 * by its rules, a path with a space or a `&` included. The shims npm, pnpm, Yarn and corepack write all end in a line
 * that runs Node on one script with `%*`: that script is run with this process's Node instead. The process started is
 * then Node itself, so stopping its tree stops the server and its memory is the server's, with no `cmd.exe` between.
 * Parsing is pure; the file system is passed in.
 *
 * @module
 */
import { readFileSync, statSync } from "node:fs";
import { win32 } from "node:path";

import { exec } from "@ensiria/cli-kit/exec";
import type { ExecOptions, ExecResult } from "@ensiria/cli-kit/exec.types";
import type { ScriptIo } from "@ensiria/cli-kit/io.types";

/** A program and its arguments, ready to spawn. */
export type Invocation = {
  /** The executable: a path, or a name looked for on the `PATH`. */
  readonly program: string;
  /** Its arguments. */
  readonly args: readonly string[];
};

/** What resolving a program reads of the system. */
export type ProgramSystem = {
  /** `process.platform`. */
  readonly platform: NodeJS.Platform;
  /** The Node that runs a shim's script. */
  readonly node: string;
  /** Whether a file exists there. */
  readonly isFile: (path: string) => boolean;
  /** A file's text. */
  readonly read: (path: string) => string;
};

/** The extensions Windows runs a program by, when `PATHEXT` says nothing. */
const DEFAULT_PATHEXT = ".COM;.EXE;.BAT;.CMD";

/** What a shim may name as its interpreter rather than its script. */
const INTERPRETER = /(^|\\)node(\.exe)?$/i;

/** This system, as `invocation` reads it. */
export const thisSystem = (): ProgramSystem => ({
  platform: process.platform,
  node: process.execPath,
  isFile: (path) => statSync(path, { throwIfNoEntry: false })?.isFile() ?? false,
  read: (path) => readFileSync(path, "utf8")
});

/**
 * The script a Windows command shim runs.
 *
 * @param text - the shim's text.
 * @param folder - the shim's folder, which `%~dp0` and `%dp0%` stand for.
 * @returns the script's full path, or nothing when the text is no shim of a known shape.
 */
export const shimScript = (text: string, folder: string): string | undefined => {
  const lines = text.split(/\r?\n/);
  const variables = new Map<string, string>();
  const expand = (value: string): string | undefined => {
    const expanded = value
      .replace(/%~dp0\\?/gi, `${folder}\\`)
      .replace(/%dp0%\\?/gi, `${folder}\\`)
      .replace(/%(\w+)%/g, (match, name: string) => variables.get(name.toUpperCase()) ?? match);
    // a value still holding a variable comes from the shim's run time (a loop, the environment): not knowable here
    return /%[^%\s]*%/.test(expanded) ? undefined : expanded;
  };
  for (const line of lines) {
    const assignment = /^\s*@?SET\s+"([A-Za-z_]\w*)=([^"]*)"\s*$/i.exec(line);
    const [, name, value] = assignment ?? [];
    if (name === undefined || value === undefined || variables.has(name.toUpperCase())) continue;
    // the first assignment is the shim's default; later ones are conditional overrides it cannot evaluate here
    const expanded = expand(value);
    if (expanded !== undefined) variables.set(name.toUpperCase(), expanded);
  }
  const run = lines.findLast((line) => line.includes("%*"));
  if (run === undefined) return undefined;
  const script = [...run.matchAll(/"([^"]+)"/g)]
    .map(([, quoted = ""]) => expand(quoted))
    .find((path) => path !== undefined && !INTERPRETER.test(path));
  return script === undefined ? undefined : win32.normalize(script);
};

/** The value of an environment variable, whatever its case: Windows names `Path` as it likes. */
const variable = (env: Readonly<Record<string, string | undefined>>, name: string): string | undefined =>
  Object.entries(env).find(([key]) => key.toUpperCase() === name)?.[1];

/** The file a Windows program name or path stands for, as `cmd.exe` would find it. */
const findWindowsProgram = (
  program: string,
  cwd: string,
  env: Readonly<Record<string, string | undefined>>,
  system: ProgramSystem
): string | undefined => {
  const extensions = (variable(env, "PATHEXT") ?? DEFAULT_PATHEXT).split(";").filter(Boolean);
  const withExtensions = (base: string): string[] =>
    extensions.some((extension) => base.toUpperCase().endsWith(extension.toUpperCase()))
      ? [base]
      : extensions.map((extension) => `${base}${extension.toLowerCase()}`);
  const isPath = /[\\/]/.test(program);
  const folders = isPath ? [cwd] : (variable(env, "PATH") ?? "").split(";").filter(Boolean);
  for (const folder of folders) {
    for (const candidate of withExtensions(win32.resolve(folder, program))) {
      if (system.isFile(candidate)) return candidate;
    }
  }
  return undefined;
};

/**
 * How to start a program with these arguments on this system.
 *
 * @param program - a name looked for on the `PATH`, or a path, relative to `cwd` or absolute.
 * @param args - its arguments.
 * @param where - the folder it runs in and its environment.
 * @param system - the system; this one by default.
 * @returns the program unchanged off Windows, or one not found (so the error names it); on Windows the file found,
 * or Node and a shim's script.
 * @throws when a Windows shim is of no shape known here: guessing would run something else.
 */
export const invocation = (
  program: string,
  args: readonly string[],
  where: { readonly cwd: string; readonly env: Readonly<Record<string, string | undefined>> },
  system: ProgramSystem = thisSystem()
): Invocation => {
  if (system.platform !== "win32") return { program, args };
  const found = findWindowsProgram(program, where.cwd, where.env, system);
  if (found === undefined) return { program, args };
  if (!/\.(cmd|bat)$/i.test(found)) return { program: found, args };
  const script = shimScript(system.read(found), win32.dirname(found));
  if (script === undefined) throw new Error(`${found} is not a command shim this benchmark can read`);
  return /\.(exe|com)$/i.test(script)
    ? { program: script, args }
    : { program: system.node, args: [script, ...args] };
};

/**
 * `exec`, with the program started as `invocation` says, so the same call works on Windows.
 *
 * @param program - the program, by name or path.
 * @param args - its arguments.
 * @param options - `exec`'s options, with the script's io, whose folder and environment the program is looked for in.
 */
export const execProgram = (
  program: string,
  args: readonly string[],
  options: ExecOptions & { readonly io: ScriptIo }
): Promise<ExecResult> => {
  const resolved = invocation(program, args, {
    cwd: options.cwd ?? options.io.cwd,
    env: options.env ?? options.io.env
  });
  return exec(resolved.program, [...resolved.args], options);
};
