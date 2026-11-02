/**
 * What the module of a package's source declares, read without running it: its id and its tokens files; and tokens files
 * read from disk, for the catalogue's answers and for `forgebook docs`.
 *
 * @remarks
 * A source's module imports the stories' index, its texts and whatever its named values need, and only a catalogue's
 * bundler answers those imports, so running it would let a broken story take the tokens down, and `forgebook docs` has
 * no bundler at all. The text is enough when `export const source` is an object written plainly. A source built by code
 * gives no id, and a `tokens` key inside it is a problem, named: its tokens would otherwise vanish in silence.
 *
 * A module that cannot be read says nothing either way, so it is `unread`, apart from `problems`: a tool shows it, but
 * only tokens known to be declared stop a check, or every catalogue would fail on a source mid-edit that has none.
 *
 * A source's paths stay inside its package. A dependency writes them and the answers travel, so a path leading out would
 * read files the dev server's `server.fs` never serves.
 *
 * @module
 */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { type ESTree, parseSync } from "vite";

import { type ParsedTokens, readTokens, type TokensInput } from "./designTokens.ts";
import { propertyValue, unwrapped } from "./indexFields.ts";

/** What a source's module says of its tokens, its paths as written. */
export type DeclaredSource = {
  /** The source's id, when written plainly. */
  readonly id: string | undefined;
  /** Its tokens files, the base first. */
  readonly tokens: readonly { readonly file: string; readonly mode: string | undefined }[];
  /** What cannot be read of tokens it does declare. */
  readonly problems: readonly string[];
  /** Why the module could not be read, so whether it declares tokens is not known. */
  readonly unread?: string;
};

/** A tokens file to read. */
export type TokensFileToRead = {
  /** Its absolute path. */
  readonly path: string;
  /** The theme it belongs to; none for the base. */
  readonly mode: string | undefined;
  /** What a problem calls it. */
  readonly label: string;
  /** The source it comes from; none for the catalogue's own. */
  readonly source?: string;
};

/** A source's tokens files, ready to read. */
export type SourceTokens = {
  /** Its id, when written plainly. */
  readonly id: string | undefined;
  /** Its tokens files. */
  readonly files: readonly TokensFileToRead[];
  /** What cannot be read of tokens it does declare. */
  readonly problems: readonly string[];
  /** Why its module could not be read, so whether it declares tokens is not known. */
  readonly unread?: string;
};

/** What to do about tokens the module's text does not give. */
const NOT_PLAIN =
  "tokens are read without running the module: write them as a list of strings or `{ file, mode }` in `export const source = { … }`";

/** What a top-level `export const source = …` holds, if the statement is one. */
const sourceValue = (
  statement: ESTree.Statement | ESTree.ModuleDeclaration
): ESTree.Expression | undefined => {
  if (statement.type !== "ExportNamedDeclaration" || statement.declaration?.type !== "VariableDeclaration")
    return undefined;
  for (const declarator of statement.declaration.declarations) {
    if (declarator.id.type === "Identifier" && declarator.id.name === "source" && declarator.init !== null)
      return unwrapped(declarator.init);
  }
  return undefined;
};

/** Whether a syntax tree holds a `tokens` key: how a source built by code still shows it means tokens. */
const holdsTokensKey = (node: unknown): boolean => {
  if (Array.isArray(node)) return node.some(holdsTokensKey);
  if (typeof node !== "object" || node === null) return false;
  const isKey =
    "type" in node &&
    node.type === "Property" &&
    "key" in node &&
    typeof node.key === "object" &&
    node.key !== null &&
    (("name" in node.key && node.key.name === "tokens") ||
      ("value" in node.key && node.key.value === "tokens"));
  return isKey || Object.values(node).some(holdsTokensKey);
};

/** A property's text, when it is written as one. */
const plainText = (object: ESTree.ObjectExpression, name: string): string | undefined => {
  const value = propertyValue(object, name);
  return value?.type === "Literal" && typeof value.value === "string" ? value.value : undefined;
};

/** One entry of the list, or none when it is not written plainly. */
const tokensEntry = (
  element: ESTree.ArrayExpression["elements"][number]
): DeclaredSource["tokens"][number] | undefined => {
  if (element === null || element.type === "SpreadElement") return undefined;
  const entry = unwrapped(element);
  if (entry.type === "Literal" && typeof entry.value === "string")
    return { file: entry.value, mode: undefined };
  if (entry.type !== "ObjectExpression") return undefined;
  const file = plainText(entry, "file");
  const mode = plainText(entry, "mode");
  return file === undefined || mode === undefined ? undefined : { file, mode };
};

/**
 * What a source's module declares, from its text.
 *
 * @param file - the module's path, for the parser (its extension says TypeScript or JSX).
 * @param text - the module's text.
 */
export const declaredSource = (file: string, text: string): DeclaredSource => {
  const { program, errors } = parseSync(file, text);
  if (errors.length > 0) {
    const unread = `it cannot be parsed: ${errors[0]?.message ?? ""}`;
    return { id: undefined, tokens: [], problems: [], unread };
  }
  const value = program.body.map(sourceValue).find((each) => each !== undefined);
  if (value?.type !== "ObjectExpression")
    return { id: undefined, tokens: [], problems: holdsTokensKey(value ?? program.body) ? [NOT_PLAIN] : [] };
  const object = value;
  const id = plainText(object, "id");
  const list = propertyValue(object, "tokens");
  if (list === undefined) return { id, tokens: [], problems: [] };
  if (list.type !== "ArrayExpression") return { id, tokens: [], problems: [NOT_PLAIN] };
  const entries = list.elements.map(tokensEntry);
  return {
    id,
    tokens: entries.filter((entry) => entry !== undefined),
    problems: entries.includes(undefined) ? [NOT_PLAIN] : []
  };
};

/** The folder of the package a module is in: the nearest with a manifest, or the module's own. */
const packageRoot = (file: string): string => {
  const start = dirname(file);
  for (let dir: string = start; dir !== dirname(dir); dir = dirname(dir)) {
    if (existsSync(join(dir, "package.json"))) return dir;
  }
  return start;
};

/** Whether a path, its links followed where it exists, is inside a folder. */
const isInside = (root: string, path: string): boolean => {
  const real = (each: string): string => (existsSync(each) ? realpathSync(each) : each);
  const fromRoot = relative(real(root), real(path));
  return fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot);
};

/**
 * What the source in a module gives, its paths absolute.
 *
 * @param file - the module's absolute path.
 * @param name - what names the module, for the problems and the files' labels (`@acme/ui/stories`).
 */
export const sourceTokensIn = (file: string, name: string): SourceTokens => {
  let declared: DeclaredSource;
  try {
    declared = declaredSource(file, readFileSync(file, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { id: undefined, files: [], problems: [], unread: `${name}: ${reason}` };
  }
  const source = declared.id ?? name;
  const root = packageRoot(file);
  const located = declared.tokens.map((each) => ({ ...each, path: resolve(dirname(file), each.file) }));
  const outside = located.filter(({ path }) => !isInside(root, path));
  return {
    id: declared.id,
    files: located
      .filter(({ path }) => isInside(root, path))
      .map(({ file: written, mode, path }) => ({ path, mode, label: `${name}: ${written}`, source })),
    problems: [...declared.problems, ...outside.map((each) => `${each.file} is outside the package`)].map(
      (problem) => `${name}: ${problem}`
    ),
    ...(declared.unread === undefined ? {} : { unread: `${name}: ${declared.unread}` })
  };
};

/** A file's content as a reading's input, or none with a problem. */
const fileInput = (file: TokensFileToRead, unread: string[]): TokensInput[] => {
  const { path, mode, label, source } = file;
  try {
    const content: unknown = JSON.parse(readFileSync(path, "utf8"));
    return [{ label, mode, file: content, ...(source === undefined ? {} : { source }) }];
  } catch (error) {
    // the parser's message quotes the file, and a path may not lead to tokens at all
    const reason = error instanceof SyntaxError ? "it is not JSON" : String(error);
    unread.push(`${label}: ${reason}`);
    return [];
  }
};

/**
 * Reads tokens files from disk.
 *
 * @param files - the files: each source's, then the catalogue's own.
 */
export const readTokenFiles = (files: readonly TokensFileToRead[]): ParsedTokens => {
  const unread: string[] = [];
  const { tokens, problems, clashes } = readTokens(files.flatMap((file) => fileInput(file, unread)));
  return { tokens, problems: [...unread, ...problems], clashes };
};
