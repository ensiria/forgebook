/**
 * The documents the evaluation writes and reads back later, a run's measures and the judges' key, checked when read:
 * a file edited by hand, or written by another version of the harness, is refused instead of giving a wrong number.
 *
 * @module
 */
import type { BlindKey } from "./blindPairs.ts";
import type { RunMeasures } from "./eval.types.ts";

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Whether a value has a run's measures' shape: the fields the pairing and the summary read.
 *
 * @param value - the parsed document.
 */
export const isRunMeasures = (value: unknown): value is RunMeasures =>
  isRecord(value) &&
  typeof value["id"] === "string" &&
  typeof value["task"] === "string" &&
  (value["arm"] === "with" || value["arm"] === "without") &&
  typeof value["repeat"] === "number" &&
  typeof value["isWorking"] === "boolean" &&
  Array.isArray(value["acceptance"]) &&
  Array.isArray(value["states"]) &&
  isRecord(value["checks"]) &&
  isRecord(value["files"]);

/** Whether a value is one side of a pair. */
const isSide = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value["run"] === "string" &&
  typeof value["code"] === "string" &&
  (value["arm"] === "with" || value["arm"] === "without");

/**
 * Whether a value has the key's shape.
 *
 * @param value - the parsed document.
 */
export const isBlindKey = (value: unknown): value is BlindKey =>
  isRecord(value) &&
  Array.isArray(value["pairs"]) &&
  Array.isArray(value["excluded"]) &&
  value["pairs"].every(
    (pair) =>
      isRecord(pair) &&
      typeof pair["code"] === "string" &&
      typeof pair["task"] === "string" &&
      isSide(pair["a"]) &&
      isSide(pair["b"])
  );

/**
 * A run's measures read from their file's text.
 *
 * @param text - the file's text.
 * @param file - its path, for the error.
 * @throws when it is not a run's measures.
 */
export const parseMeasures = (text: string, file: string): RunMeasures => {
  const value: unknown = JSON.parse(text);
  if (!isRunMeasures(value)) throw new Error(`${file} is not a run's measures`);
  return value;
};

/**
 * The key read from its file's text.
 *
 * @param text - the file's text.
 * @param file - its path, for the error.
 * @throws when it is not a key.
 */
export const parseKey = (text: string, file: string): BlindKey => {
  const value: unknown = JSON.parse(text);
  if (!isBlindKey(value)) throw new Error(`${file} is not the evaluation's key`);
  return value;
};
