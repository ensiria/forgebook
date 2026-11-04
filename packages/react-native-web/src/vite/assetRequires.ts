/**
 * React Native's way of naming an image or a font, `require("./logo.png")`, written as the import a web bundler reads:
 * the asset's address. Pure: the plugin (`nativePlugin.ts`) parses a module and applies it, the tests call it.
 *
 * @remarks
 * Metro turns `require("./logo.png")` into an asset's number; react-native-web's `Image` and Expo's font loader take
 * an address as well, so the call becomes the asset's default import, which Vite makes its address (and copies the
 * file into a built catalogue). Only a module that is already an ES module is rewritten, since an import in a
 * CommonJS file would change what it is; a module's own code keeps its lines and columns: each call is replaced by a
 * name padded to the call's length and the imports go at the end (imports are hoisted), so its source map needs no
 * change.
 *
 * @module
 */

import { codeLiteral } from "forgebook/code-literal";

/** The files a `require` names as an asset rather than a module: images, fonts, sounds and videos. */
export const ASSET_FILE = /\.(?:png|jpe?g|gif|webp|bmp|svg|ttf|otf|woff2?|mp3|wav|m4a|aac|mp4|webm|mov)$/i;

/** A node of the module's syntax tree, as the parser gives it (ESTree, with offsets). */
type SyntaxNode = {
  /** The node's kind (`CallExpression`). */
  readonly type: string;
  /** Its first character's offset in the module. */
  readonly start: number;
  /** The offset after its last character. */
  readonly end: number;
};

/** One `require` of an asset: where it is, and the asset it names. */
type AssetRequire = {
  /** The call's first character's offset. */
  readonly start: number;
  /** The offset after the call. */
  readonly end: number;
  /** The asset, as the call names it (`./logo.png`). */
  readonly specifier: string;
};

/** The statements that make a module an ES module. */
const MODULE_STATEMENTS = new Set([
  "ImportDeclaration",
  "ExportNamedDeclaration",
  "ExportDefaultDeclaration",
  "ExportAllDeclaration"
]);

/** Whether a value is a syntax node. */
const isNode = (value: unknown): value is SyntaxNode =>
  typeof value === "object" &&
  value !== null &&
  "type" in value &&
  typeof value.type === "string" &&
  "start" in value &&
  typeof value.start === "number" &&
  "end" in value &&
  typeof value.end === "number";

/** A node's property, by name: the children are read without knowing each node's shape. */
const propertyOf = (node: SyntaxNode, name: string): unknown =>
  Object.entries(node).find(([key]) => key === name)?.[1];

/**
 * The asset a call requires: `require("./logo.png")` with one text naming an asset.
 *
 * @param node - a call.
 * @returns the asset's specifier, or none for any other call.
 */
const requiredAsset = (node: SyntaxNode): string | undefined => {
  const callee = propertyOf(node, "callee");
  const args = propertyOf(node, "arguments");
  if (!isNode(callee) || callee.type !== "Identifier" || propertyOf(callee, "name") !== "require")
    return undefined;
  if (!Array.isArray(args) || args.length !== 1) return undefined;
  const [argument]: unknown[] = args;
  if (!isNode(argument) || argument.type !== "Literal") return undefined;
  const value = propertyOf(argument, "value");
  return typeof value === "string" && ASSET_FILE.test(value) ? value : undefined;
};

/**
 * The nodes under a node, in the order the module writes them: its properties that are nodes or lists of nodes.
 *
 * @param node - the node.
 */
const childrenOf = (node: SyntaxNode): SyntaxNode[] =>
  Object.entries(node)
    .filter(([key]) => key !== "type")
    .flatMap(([, child]: [string, unknown]) => (Array.isArray(child) ? child : [child]))
    .filter(isNode);

/**
 * Every `require` of an asset in a tree, in the order the module writes them.
 *
 * @param root - the module's tree.
 */
const assetRequires = (root: SyntaxNode): AssetRequire[] => {
  const found: AssetRequire[] = [];
  const pending = [root];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    const specifier = node.type === "CallExpression" ? requiredAsset(node) : undefined;
    if (specifier === undefined) pending.push(...childrenOf(node));
    else found.push({ start: node.start, end: node.end, specifier });
  }
  return found.sort((left, right) => left.start - right.start);
};

/**
 * Whether a module is an ES module: it imports or exports.
 *
 * @param program - the module's tree.
 */
const isEsModule = (program: SyntaxNode): boolean => {
  const body = propertyOf(program, "body");
  return (
    Array.isArray(body) &&
    body.some((statement) => isNode(statement) && MODULE_STATEMENTS.has(statement.type))
  );
};

/**
 * The start of the names the imports take: one the module does not use, so no name it declares is taken twice.
 *
 * @param code - the module's code.
 */
const namePrefix = (code: string): string => {
  let prefix = "__fbAsset";
  while (code.includes(prefix)) prefix = `_${prefix}`;
  return prefix;
};

/**
 * A name in place of a call, keeping its line breaks, so every later line stays where it was: the name padded to the
 * call's first line, spaces on its others (a first line shorter than the name, `require(` alone, moves only what
 * follows the call on its last line).
 *
 * @param call - the call's text.
 * @param name - the name.
 */
const inPlaceOf = (call: string, name: string): string => {
  const [first = "", ...rest] = call.split("\n");
  // the shortest call, `require("a.png")`, is longer than any name up to a hundred thousand assets
  const firstLine = first.length >= name.length ? name.padEnd(first.length, " ") : name;
  return [firstLine, ...rest.map((line) => " ".repeat(line.length))].join("\n");
};

/**
 * A module's `require`s of assets written as imports of their addresses.
 *
 * @param code - the module's code.
 * @param program - its tree, as the parser gives it.
 * @returns the code, or none when nothing is rewritten (no asset is required, or the module is CommonJS).
 */
export const importedAssets = (code: string, program: unknown): string | undefined => {
  if (!isNode(program) || !code.includes("require") || !isEsModule(program)) return undefined;
  const calls = assetRequires(program);
  if (calls.length === 0) return undefined;
  const prefix = namePrefix(code);
  const names = new Map<string, string>();
  let rewritten = "";
  let at = 0;
  for (const call of calls) {
    const name = names.get(call.specifier) ?? `${prefix}${names.size}`;
    names.set(call.specifier, name);
    rewritten += code.slice(at, call.start) + inPlaceOf(code.slice(call.start, call.end), name);
    at = call.end;
  }
  const imports = [...names].map(([specifier, name]) => `import ${name} from ${codeLiteral(specifier)};`);
  return `${rewritten}${code.slice(at)}\n${imports.join("\n")}\n`;
};
