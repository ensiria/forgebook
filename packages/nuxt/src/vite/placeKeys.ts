/**
 * The keys of a place in the code, as Nuxt's compiler writes them: `useState()`, `useAsyncData(handler)` and
 * `callOnce(fn)` called without a key get one more argument, a key made from the file and the call's place, so every
 * component that calls them from that place shares the value, and only those.
 *
 * @remarks
 * Nuxt adds the key when the call has fewer arguments than the function takes with one, as here; the stand-ins read a
 * text last as that key (`src/app`). `useFetch` gets none: its key is the request, which a story writes. A call to a
 * function of the same name imported from elsewhere is left alone.
 *
 * @module
 */
import { createHash } from "node:crypto";

import { codeLiteral } from "forgebook/code-literal";
import type MagicString from "magic-string";

/** The functions keyed by their place, with the number of arguments a call has once keyed. */
const KEYED: Readonly<Record<string, number>> = {
  useState: 2,
  useAsyncData: 3,
  useLazyAsyncData: 3,
  callOnce: 3
};

/** The modules Nuxt's names come from, besides an auto-import. */
const NUXT_MODULE = /^(#imports|#app|nuxt\/app|@forgebook\/nuxt\/app\/.+)$/;

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The names a file imports from a module that is not Nuxt's: a call of one of them is not Nuxt's.
 *
 * @param program - the file's syntax tree.
 */
const foreignNames = (program: unknown): Set<string> => {
  const names = new Set<string>();
  const body = isRecord(program) && Array.isArray(program["body"]) ? program["body"] : [];
  for (const statement of body) for (const name of importedNames(statement)) names.add(name);
  return names;
};

/**
 * The names a statement imports from a module that is not Nuxt's; none for another statement.
 *
 * @param statement - the statement.
 */
const importedNames = (statement: unknown): string[] => {
  if (!isRecord(statement) || statement["type"] !== "ImportDeclaration") return [];
  const source = statement["source"];
  const from = isRecord(source) && typeof source["value"] === "string" ? source["value"] : "";
  if (NUXT_MODULE.test(from)) return [];
  const specifiers: unknown[] = Array.isArray(statement["specifiers"]) ? statement["specifiers"] : [];
  return specifiers.flatMap((specifier) => {
    const local = isRecord(specifier) ? specifier["local"] : undefined;
    return isRecord(local) && typeof local["name"] === "string" ? [local["name"]] : [];
  });
};

/** A call that gets a key: where its key goes, and whether it goes after an argument. */
type KeyedCall = {
  /** Where the key is written. */
  readonly at: number;
  /** Whether an argument comes before it, so the key follows a comma. */
  readonly isAfterArgument: boolean;
};

/**
 * The calls of a syntax tree that get a key.
 *
 * @param node - the tree, or a part of it.
 * @param foreign - the names imported from elsewhere.
 * @param found - where the calls found are added.
 */
const keyedCalls = (node: unknown, foreign: ReadonlySet<string>, found: KeyedCall[]): void => {
  if (Array.isArray(node)) {
    for (const each of node) keyedCalls(each, foreign, found);
    return;
  }
  if (!isRecord(node)) return;
  const call = keyedCall(node, foreign);
  if (call !== undefined) found.push(call);
  for (const [field, value] of Object.entries(node))
    if (field !== "type" && typeof value === "object") keyedCalls(value, foreign, found);
};

/**
 * Where a node's key goes, when it is a call of a keyed function without its key.
 *
 * @param node - the node.
 * @param foreign - the names imported from elsewhere.
 */
const keyedCall = (
  node: Readonly<Record<string, unknown>>,
  foreign: ReadonlySet<string>
): KeyedCall | undefined => {
  if (node["type"] !== "CallExpression") return undefined;
  const callee = node["callee"];
  const name = isRecord(callee) && callee["type"] === "Identifier" ? callee["name"] : undefined;
  const length = typeof name === "string" && !foreign.has(name) ? KEYED[name] : undefined;
  const args: unknown[] = Array.isArray(node["arguments"]) ? node["arguments"] : [];
  if (length === undefined || args.length >= length) return undefined;
  const last = args.at(-1);
  const lastEnd = isRecord(last) ? last["end"] : undefined;
  if (typeof lastEnd === "number") return { at: lastEnd, isAfterArgument: true };
  const end = node["end"];
  return args.length === 0 && typeof end === "number" ? { at: end - 1, isAfterArgument: false } : undefined;
};

/**
 * Gives each call to a keyed function without a key the key of its place.
 *
 * @param code - the file's code, changed in place.
 * @param program - its syntax tree, whose places are the code's.
 * @param file - the file, as the project names it, which the keys are made from.
 * @returns whether a key was written.
 */
export const withPlaceKeys = (code: MagicString, program: unknown, file: string): boolean => {
  const found: KeyedCall[] = [];
  keyedCalls(program, foreignNames(program), found);
  for (const call of found) {
    const key = `$${createHash("sha256").update(`${file}:${call.at}`).digest("base64url").slice(0, 10)}`;
    code.appendLeft(call.at, `${call.isAfterArgument ? ", " : ""}${codeLiteral(key)}`);
  }
  return found.length > 0;
};
