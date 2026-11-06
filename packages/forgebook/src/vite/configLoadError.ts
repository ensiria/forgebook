/**
 * What to say when a configuration file does not load: the file, and for a syntax error its line and column, in the form
 * editors and terminals open (`/path/forgebook.config.ts:3:3: …`).
 *
 * @remarks
 * Node names the place of a syntax error in TypeScript in the error's stack: the file and line, then the source with
 * carets under the mistake, for whichever file was at fault, which may be one the configuration imports. For JavaScript
 * it says nothing (the place is printed only when the process dies of it), so the file is read again with the TypeScript
 * parser, loaded only here since a configuration that loads never needs it. That finds a mistake in the configuration
 * itself; one in a JavaScript file it imports keeps Node's message under the configuration's name.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Where a syntax error is. */
type ErrorPlace = {
  /** The file, by absolute path. */
  readonly file: string;
  /** Its line, from 1. */
  readonly line: number;
  /** Its column, from 1. */
  readonly column: number;
};

/** The first line of a stack Node decorated with the source: the file, by address or by path, and the line. */
const STACK_HEAD = /^(file:\/\/.+|\/.+|[A-Za-z]:\\.+):(\d+)$/;

/** The line under the source that points at the mistake. */
const CARETS = /^(\s*)\^+\s*$/;

/**
 * Where Node's stack says a syntax error is, when it says.
 *
 * @param stack - the error's stack.
 */
export const placeInStack = (stack: string): ErrorPlace | undefined => {
  const lines = stack.split("\n");
  const head = STACK_HEAD.exec(lines[0] ?? "");
  const named = head?.[1];
  const line = head?.[2];
  if (named === undefined || line === undefined) return undefined;
  const carets = lines.map((each) => CARETS.exec(each)).find((match) => match !== null);
  return {
    file: named.startsWith("file://") ? fileURLToPath(named) : named,
    line: Number(line),
    column: (carets?.[1]?.length ?? 0) + 1
  };
};

/**
 * Where the TypeScript parser finds the first syntax error of a file, when it finds one.
 *
 * @param file - the file, by absolute path.
 */
const placeInFile = async (file: string): Promise<ErrorPlace | undefined> => {
  const { default: ts } = await import("typescript-6");
  const { diagnostics = [] } = ts.transpileModule(readFileSync(file, "utf8"), {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext }
  });
  const first = diagnostics.find((each) => each.file !== undefined && each.start !== undefined);
  if (first?.file === undefined || first.start === undefined) return undefined;
  const { line, character } = first.file.getLineAndCharacterOfPosition(first.start);
  return { file, line: line + 1, column: character + 1 };
};

/**
 * The message for a configuration file that did not load.
 *
 * @param file - the configuration file, by absolute path.
 * @param error - what its import threw.
 */
export const configLoadMessage = async (file: string, error: unknown): Promise<string> => {
  const message = error instanceof Error ? error.message : String(error);
  if (!(error instanceof SyntaxError)) return `${file}: it did not load: ${message}`;
  const place = placeInStack(error.stack ?? "") ?? (await placeInFile(file).catch(() => undefined));
  return place === undefined
    ? `${file}: ${message}`
    : `${place.file}:${place.line}:${place.column}: ${message}`;
};
