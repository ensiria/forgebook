/**
 * What `forgebook build` says when the bundler fails: each error on a line, with its file, line and column when they
 * are known. The bundler's own message holds its frames and a code frame in colours, which only `--verbose` shows.
 *
 * @module
 */
import { stripVTControlCharacters } from "node:util";

import { type BundlerErrorPlace, bundlerErrorLines } from "../../src/bundlerErrors.ts";

/** Whether a value is an object, whose fields can be read. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

/**
 * What an error says of its place, as far as it holds the right shapes.
 *
 * @param error - the error, as the bundler gives it.
 */
const placeOf = (error: Readonly<Record<string, unknown>>): BundlerErrorPlace => {
  const { id, loc } = error;
  const line = isRecord(loc) ? loc["line"] : undefined;
  const column = isRecord(loc) ? loc["column"] : undefined;
  return {
    ...(typeof id === "string" ? { id } : {}),
    ...(typeof line === "number" && typeof column === "number" ? { loc: { line, column } } : {})
  };
};

/**
 * The lines of one of the build's errors.
 *
 * @param error - the error, as the bundler gives it.
 */
const errorLines = (error: unknown): readonly string[] => {
  if (!isRecord(error)) return bundlerErrorLines(String(error));
  const { message } = error;
  return bundlerErrorLines(stripVTControlCharacters(String(message)), placeOf(error));
};

/**
 * What a failed build says.
 *
 * @param error - what the build threw: Vite's bundler lists its errors in `errors`.
 * @returns the text, a line per error.
 */
export const buildFailureText = (error: unknown): string => {
  const list = isRecord(error) ? error["errors"] : undefined;
  const errors: readonly unknown[] = Array.isArray(list) ? list : [error];
  const lines = errors.flatMap(errorLines);
  return lines.length === 0 ? "The build failed" : lines.join("\n");
};
