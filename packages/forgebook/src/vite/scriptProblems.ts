/**
 * The project's scripts that do not parse, other than story files: each one a problem naming its place, among the
 * index's problems, so a component that does not parse is named once, before any frame loads it, to people and agents.
 *
 * @remarks
 * Vite's dependency scan finds them (`prebundled.ts`), and an edit of a script finds them on a dev server, which also
 * recovers on the fix. The scan may run in a process of its own (a first start's pre-bundling), and a later start that
 * keeps the pre-bundled packages does not scan: what it found is kept in Forgebook's cache folder, read when a dev
 * server starts, and each file read again then, so a file fixed in between is not named. A file broken while no server
 * ran is named once it is edited, or by the frames of the stories that import it. Story files are the catalogue's own
 * to name (`storyFilesModule.ts`).
 *
 * @module
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { type Logger, parseSync } from "vite";

import type { StoryFileRead } from "../hotModules.ts";
import { STORY_FILE } from "./autoTitle.ts";
import { lineAndColumn } from "./lineAndColumn.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/** A project's script: JavaScript or TypeScript, with or without JSX. */
export const SCRIPT = /\.[cm]?[jt]sx?$/;

/** A file of an installed package, which is not the project's to fix. */
export const INSTALLED = /[\\/]node_modules[\\/]/;

/** A script whose extension says nothing about JSX: it may hold JSX, as libraries written in JavaScript do. */
const PLAIN_SCRIPT = /\.[cm]?js$/;

/** The file the found problems are kept in, in Forgebook's cache folder. */
const KEPT_FILE = "script-problems.json";

/** A script parsed: its imports, and why it does not parse. */
export type ParsedScript = {
  /** The modules it imports statically, as written. */
  readonly imports: readonly string[];
  /** Whether it parses only as JSX (a `.js` file holding JSX). */
  readonly isJsx: boolean;
  /** Why it does not parse, naming the file with its line and column; none when it parses. */
  readonly problem: string | undefined;
};

/**
 * A script parsed as its extension says, and as JSX when only that makes a plain `.js` file parse.
 *
 * @param file - the script's path, as the problem names it; its extension decides TypeScript and JSX.
 * @param text - its source.
 */
export const parsedScript = (file: string, text: string): ParsedScript => {
  const parsed = parseSync(file, text);
  const imports = parsed.module.staticImports.map((each) => each.moduleRequest.value);
  const [error] = parsed.errors;
  if (error === undefined) return { imports, isJsx: false, problem: undefined };
  if (PLAIN_SCRIPT.test(file)) {
    const asJsx = parseSync(file, text, { lang: "jsx" });
    if (asJsx.errors.length === 0) {
      return {
        imports: asJsx.module.staticImports.map((each) => each.moduleRequest.value),
        isJsx: true,
        problem: undefined
      };
    }
  }
  const [label] = error.labels;
  const place = label === undefined ? file : `${file}:${lineAndColumn(text, label.start)}`;
  return { imports, isJsx: false, problem: `${place} does not parse: ${error.message}` };
};

/**
 * Whether a file is one of the project's scripts this module names: not a story file, not an installed package's.
 *
 * @param file - the file.
 */
export const isNamedScript = (file: string): boolean =>
  SCRIPT.test(file) && !INSTALLED.test(file) && !STORY_FILE.test(file);

/** The project's scripts that do not parse, as a dev server or a dependency scan knows them. */
export type ScriptProblems = {
  /**
   * Starts once Vite's configuration is resolved: keeps the logger the scan's warnings go to, and the folder the
   * problems are kept in between processes, reading what an earlier scan found there, each file read again.
   *
   * @param logger - Vite's logger.
   * @param folder - Forgebook's cache folder; none keeps nothing (a build).
   */
  readonly start: (logger: Pick<Logger, "warn">, folder: string | undefined) => void;
  /** Writes a warning of the scan, once the logger is known (the scan runs after the configuration is resolved). */
  readonly warn: (line: string) => void;
  /**
   * Notes what a scan found of a script.
   *
   * @param file - the script, absolute.
   * @param problem - why it does not parse; none when it does.
   * @returns whether that is new: a problem not known before.
   */
  readonly scanned: (file: string, problem: string | undefined) => boolean;
  /**
   * Reads an edited script again.
   *
   * @param file - the script, absolute.
   * @returns whether it parses now, when that changed; none when nothing changed.
   */
  readonly edited: (file: string) => StoryFileRead | undefined;
  /** The problems, one per script. */
  readonly list: () => readonly string[];
};

/**
 * Why a script on disk does not parse; none when it does, or cannot be read (an editor writes it anew in place).
 *
 * @param file - the script, absolute in Vite's form.
 */
const problemOnDisk = (file: string): string | undefined => {
  if (!existsSync(file)) return undefined;
  try {
    return parsedScript(file, readFileSync(file, "utf8")).problem;
  } catch {
    return undefined;
  }
};

/**
 * The problems kept in a folder, each file read again; none when nothing is kept there.
 *
 * @param path - the kept file.
 */
const keptProblems = (path: string): Map<string, string> => {
  const problems = new Map<string, string>();
  if (!existsSync(path)) return problems;
  try {
    const kept: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!Array.isArray(kept)) return problems;
    for (const file of kept) {
      if (typeof file !== "string") continue;
      const problem = problemOnDisk(file);
      if (problem !== undefined) problems.set(file, problem);
    }
  } catch {
    // a file another version wrote, or half written: the next scan or edit writes it anew
  }
  return problems;
};

/** The project's scripts that do not parse, empty until a scan or an edit finds one. */
export const scriptProblems = (): ScriptProblems => {
  const problems = new Map<string, string>();
  let keptPath: string | undefined;
  let logger: Pick<Logger, "warn"> | undefined;
  const keep = (): void => {
    if (keptPath === undefined) return;
    try {
      mkdirSync(VITE_PATHS.dirname(keptPath), { recursive: true });
      writeFileSync(keptPath, JSON.stringify([...problems.keys()]));
    } catch {
      // a read-only cache folder: the problems stay this process's
    }
  };
  return {
    start: (started: Pick<Logger, "warn">, folder: string | undefined): void => {
      logger = started;
      if (folder === undefined) return;
      keptPath = join(folder, KEPT_FILE);
      for (const [file, problem] of keptProblems(keptPath)) problems.set(file, problem);
    },
    warn: (line: string): void => logger?.warn(line),
    scanned: (file: string, problem: string | undefined): boolean => {
      const key = VITE_PATHS.normalize(file);
      const before = problems.get(key);
      if (problem === undefined) problems.delete(key);
      else problems.set(key, problem);
      if (before !== problem) keep();
      return problem !== undefined && before !== problem;
    },
    edited: (file: string): StoryFileRead | undefined => {
      const key = VITE_PATHS.normalize(file);
      if (!isNamedScript(key)) return undefined;
      const problem = problemOnDisk(key);
      if (problem === problems.get(key)) return undefined;
      if (problem === undefined) problems.delete(key);
      else problems.set(key, problem);
      keep();
      return { file: key, ...(problem === undefined ? {} : { problem }) };
    },
    list: (): readonly string[] => [...problems.values()]
  };
};
