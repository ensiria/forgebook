/**
 * How a program is started on each system: as named on macOS and Linux; on Windows, a package's command is a `.cmd`
 * shim, which is read so its script runs with Node directly.
 *
 * @remarks
 * Node refuses to spawn a `.cmd` or a `.bat` without a shell, and through `cmd.exe` every argument would need quoting
 * by its rules, a path with a space or a `&` included. The shims npm, pnpm, Yarn and corepack write all end in a line
 * that runs Node on one script with `%*`: that script is run with this process's Node instead. The process started is
 * then Node itself, so stopping its tree stops the server and its memory is the server's, with no `cmd.exe` between.
 *
 * Every program the benchmark runs to completion goes through `execProgram`, which needs a time limit and enforces it
 * on the whole tree: cli-kit's own runner stops only the program it started and then waits for its output pipes to
 * close, and a grandchild that inherited them (a package's install script, a build's worker) keeps them open, so the
 * wait never ends, on Windows above all, where stopping a process leaves its children running. Here the tree is
 * stopped, and the end of the program is its exit: pipes still open a few seconds later are closed from this side.
 * Parsing is pure; the file system is passed in.
 *
 * @module
 */
import { spawn } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { win32 } from "node:path";

import { exec } from "@ensiria/cli-kit/exec";
import type {
  ExecOptions,
  ExecResult,
  ProgramOutcome,
  ProgramRequest,
  ProgramRunner
} from "@ensiria/cli-kit/exec.types";
import type { ScriptIo } from "@ensiria/cli-kit/io.types";

import { isOwnGroup, killTree } from "./processTree.ts";

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

/** How long a program's output pipes may stay open after it exited, in milliseconds: a child of it holds them. */
const DRAIN_TIMEOUT = 5000;

/** The most of a program's output kept, in characters: its end, which is where a failure says why. */
const KEPT_OUTPUT = 1_000_000;

/** A text with a chunk added, cut to its last `KEPT_OUTPUT` characters. */
const keepEnd = (text: string, chunk: string): string => {
  const joined = `${text}${chunk}`;
  return joined.length > KEPT_OUTPUT ? joined.slice(-KEPT_OUTPUT) : joined;
};

/**
 * cli-kit's `ProgramRunner`, for programs that start others: the tree in a group of its own where the system has
 * them, all of it stopped at the time limit, and the run over at the program's exit.
 *
 * @remarks
 * Output is kept, as `capture` keeps it; a request for another mode is kept the same way, since the benchmark prints
 * nothing of the programs it runs. Its stdin is closed unless the request gives text, so a program that asks a
 * question reads its end instead of waiting for an answer.
 *
 * @param request - the program and how to run it.
 */
export const treeRunner: ProgramRunner = (request: ProgramRequest): Promise<ProgramOutcome> =>
  new Promise((resolve) => {
    const child = spawn(request.program, [...request.args], {
      cwd: request.cwd,
      env: request.env,
      stdio: [request.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      detached: isOwnGroup,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    let isTimedOut = false;
    let isSettled = false;
    child.stdout?.setEncoding("utf8").on("data", (chunk: string) => {
      stdout = keepEnd(stdout, chunk);
    });
    child.stderr?.setEncoding("utf8").on("data", (chunk: string) => {
      stderr = keepEnd(stderr, chunk);
    });
    const settle = (outcome: ProgramOutcome): void => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timer);
      resolve(outcome);
    };
    const ended = (code: number | null, signal: NodeJS.Signals | null): void =>
      settle(
        isTimedOut ? { kind: "timeout", stdout, stderr } : { kind: "ended", stdout, stderr, code, signal }
      );
    const timer =
      request.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            isTimedOut = true;
            // a tree that will not go, or a kill that failed, must not hold the call: its pipes are closed from here
            const pid = child.pid;
            void (pid === undefined ? Promise.resolve() : killTree(pid)).then(() =>
              setTimeout(() => {
                child.stdout?.destroy();
                child.stderr?.destroy();
                ended(null, null);
              }, DRAIN_TIMEOUT)
            );
          }, request.timeoutMs);
    child.on("error", (error: NodeJS.ErrnoException) => {
      settle(error.code === "ENOENT" ? { kind: "missing" } : { kind: "failed", message: error.message });
    });
    child.on("close", ended);
    child.on("exit", (code, signal) => {
      // what the program started and left holding its pipes is stopped, then the pipes are closed from here
      const drain = setTimeout(() => {
        if (child.pid !== undefined) void killTree(child.pid);
        child.stdout?.destroy();
        child.stderr?.destroy();
        ended(code, signal);
      }, DRAIN_TIMEOUT);
      child.once("close", () => clearTimeout(drain));
    });
    child.stdin?.end(request.input);
  });

/** A minute, in milliseconds. */
const MINUTE = 60_000;

/**
 * The time limits of the programs the benchmark runs to completion, in milliseconds. Generous: a slow PC on a slow
 * network is still a PC to measure, and a limit is there only to end a program that would never end.
 */
export const TIME_LIMITS = {
  /** A question to the system or to Git: `ps`, `df`, `git rev-parse`, a reading of the machine. */
  query: MINUTE,
  /** Building and packing Forgebook's packages. */
  pack: 20 * MINUTE,
  /** An install of a tool or of a library's dependencies, a large monorepo's included. */
  install: 90 * MINUTE,
  /** Fetching a library's pinned commit. */
  fetch: 60 * MINUTE,
  /** A library's own preparation: what its stories import, built. */
  prepare: 90 * MINUTE
} as const;

/** `exec`'s options for a program of the benchmark: a time limit is required, and the script's io. */
export type ProgramOptions = ExecOptions & {
  /** How long it may run, in milliseconds, before its whole tree is stopped and the call fails. */
  readonly timeoutMs: number;
  /** The script's streams. */
  readonly io: ScriptIo;
};

/**
 * `exec`, with the program started as `invocation` says, so the same call works on Windows, and run by `treeRunner`,
 * so its time limit holds for everything it started.
 *
 * @param program - the program, by name or path.
 * @param args - its arguments.
 * @param options - `exec`'s options, with the script's io, whose folder and environment the program is looked for in,
 * and a time limit.
 */
export const execProgram = (
  program: string,
  args: readonly string[],
  options: ProgramOptions
): Promise<ExecResult> => {
  const resolved = invocation(program, args, {
    cwd: options.cwd ?? options.io.cwd,
    env: options.env ?? options.io.env
  });
  // a test's io answers in place of real programs; every other io gets the runner that stops whole trees
  const io: ScriptIo = { ...options.io, runProgram: options.io.runProgram ?? treeRunner };
  return exec(resolved.program, [...resolved.args], { ...options, io });
};
