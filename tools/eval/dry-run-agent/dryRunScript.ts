/**
 * The dry-run stand-in's script: the edits a task's `dry-run/<arm>.json` lists, applied to a project as an agent would
 * make them, so the evaluation's pipeline can be proven end to end without a model.
 *
 * @remarks
 * Pure: a script and the files' texts in, the new texts out. An edit whose text is not found fails, so a script that
 * drifted from its app's commit is noticed, not silently skipped.
 *
 * @module
 */
import { isAbsolute, relative, resolve } from "node:path";

/** One edit: a text replaced once in a file, or a file written whole. */
export type DryRunEdit =
  | { readonly file: string; readonly find: string; readonly replace: string }
  | { readonly file: string; readonly write: string };

/** A task's script for one arm. */
export type DryRunScript = {
  /** What the stand-in prints first, as an agent's account of its work. */
  readonly say: string;
  /** The edits, in order. */
  readonly edits: readonly DryRunEdit[];
  /** What it claims at its end. */
  readonly result: "done" | "not done";
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a path stays inside the project. */
const isInside = (path: string): boolean => {
  if (isAbsolute(path)) return false;
  const inside = relative("/root", resolve("/root", path));
  return inside !== "" && !inside.startsWith("..");
};

/**
 * Reads a script.
 *
 * @param text - the file's text.
 * @throws when it is not one.
 */
export const parseScript = (text: string): DryRunScript => {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value) || typeof value["say"] !== "string" || !Array.isArray(value["edits"]))
    throw new Error("a dry-run script needs say and edits");
  const edits = value["edits"].map((edit, index): DryRunEdit => {
    if (!isRecord(edit) || typeof edit["file"] !== "string" || !isInside(edit["file"]))
      throw new Error(`edit ${index + 1}: "file" must be a path inside the project`);
    if (typeof edit["write"] === "string") return { file: edit["file"], write: edit["write"] };
    if (typeof edit["find"] === "string" && typeof edit["replace"] === "string")
      return { file: edit["file"], find: edit["find"], replace: edit["replace"] };
    throw new Error(`edit ${index + 1}: needs write, or find and replace`);
  });
  const result = value["result"] === "not done" ? "not done" : "done";
  return { say: value["say"], edits, result };
};

/**
 * Applies one edit to a file's text.
 *
 * @param text - the file's text; none for a file not there.
 * @param edit - the edit.
 * @throws when the text to replace is not there exactly once.
 */
export const applyEdit = (text: string | undefined, edit: DryRunEdit): string => {
  if ("write" in edit) return edit.write;
  if (text === undefined) throw new Error(`${edit.file} is not there`);
  const at = text.indexOf(edit.find);
  if (at === -1) throw new Error(`${edit.file}: the text to replace is not there`);
  if (text.indexOf(edit.find, at + 1) !== -1)
    throw new Error(`${edit.file}: the text to replace is there twice`);
  return `${text.slice(0, at)}${edit.replace}${text.slice(at + edit.find.length)}`;
};
