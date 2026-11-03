/**
 * The calls of `next/font` in a module (`const inter = Inter({ subsets: ["latin"] })`), found and replaced by the
 * fonts they load.
 *
 * @remarks
 * Next.js's compiler rewrites each call into a style sheet it builds at build time, which is why `next/font` requires
 * its options written as literals; the functions `next/font/google` exports do nothing at run time. This does the same
 * rewrite for Vite: each call becomes an import of a module the plugin builds (`fontModule.ts`), and the import of
 * `next/font` goes. Pure: a module's text in, its new text out; the lines stay where they were, so the module's
 * source map needs no change.
 *
 * @module
 */
import { parseSync } from "vite";

/** Which of Next.js's font loaders a call uses. */
export type FontLoader = "google" | "local";

/** A call of a font loader. */
export type FontCall = {
  /** The loader. */
  readonly loader: FontLoader;
  /** The Google font's family, from the function's name (`Roboto_Mono` → `Roboto Mono`); none for a local font. */
  readonly family: string | undefined;
  /** The name of the constant the call is assigned to (`inter`), which names a local font's family. */
  readonly variable: string | undefined;
  /** The options, as written. */
  readonly options: Readonly<Record<string, unknown>>;
  /** Where the call starts in the module's text. */
  readonly start: number;
  /** Where the call ends. */
  readonly end: number;
};

/** What a module holds of `next/font`. */
export type FontModuleCalls = {
  /** The calls, in order. */
  readonly calls: readonly FontCall[];
  /** Where the imports of `next/font` are, to take away. */
  readonly imports: readonly { readonly start: number; readonly end: number }[];
  /** What could not be read, each a sentence. */
  readonly problems: readonly string[];
};

/** The modules each loader is imported from (`@next/font` is the package before Next.js 13.2). */
const LOADER_MODULES: Readonly<Record<string, FontLoader>> = {
  "next/font/google": "google",
  "next/font/local": "local",
  "@next/font/google": "google",
  "@next/font/local": "local"
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A value that is not written as a literal. */
const NOT_LITERAL: unique symbol = Symbol("not literal");

/**
 * A template literal's text when it holds no expression, or `NOT_LITERAL`.
 *
 * @param node - the template literal.
 */
const templateValue = (node: Readonly<Record<string, unknown>>): unknown => {
  const { quasis, expressions } = node;
  if (!Array.isArray(quasis) || !Array.isArray(expressions) || expressions.length > 0) return NOT_LITERAL;
  const first: unknown = quasis[0];
  const cooked = isRecord(first) && isRecord(first["value"]) ? first["value"]["cooked"] : undefined;
  return typeof cooked === "string" ? cooked : NOT_LITERAL;
};

/**
 * An array literal's values, or `NOT_LITERAL`.
 *
 * @param elements - its elements.
 */
const arrayValue = (elements: unknown): unknown => {
  if (!Array.isArray(elements)) return NOT_LITERAL;
  const values = elements.map(literalValue);
  return values.includes(NOT_LITERAL) ? NOT_LITERAL : values;
};

/**
 * A node's value when it is written as a literal (texts, numbers, booleans, lists and objects of them), or
 * `NOT_LITERAL`.
 *
 * @param node - an expression of the syntax tree.
 */
const literalValue = (node: unknown): unknown => {
  if (!isRecord(node)) return NOT_LITERAL;
  switch (node["type"]) {
    case "Literal":
      return node["value"] instanceof RegExp ? NOT_LITERAL : node["value"];
    case "TemplateLiteral":
      return templateValue(node);
    case "ArrayExpression":
      return arrayValue(node["elements"]);
    case "ObjectExpression":
      return literalObject(node["properties"]);
    case "TSAsExpression":
    case "TSSatisfiesExpression":
      return literalValue(node["expression"]);
    default:
      return NOT_LITERAL;
  }
};

/**
 * A property's name, written as a name or as a literal.
 *
 * @param key - the property's key.
 */
const propertyName = (key: unknown): unknown => {
  if (!isRecord(key)) return undefined;
  return key["type"] === "Identifier" ? key["name"] : key["value"];
};

/**
 * An object literal's value, or `NOT_LITERAL`.
 *
 * @param properties - its properties.
 */
const literalObject = (properties: unknown): unknown => {
  if (!Array.isArray(properties)) return NOT_LITERAL;
  const entries: [string, unknown][] = [];
  for (const property of properties) {
    const isPlain = isRecord(property) && property["type"] === "Property" && property["computed"] !== true;
    const name = isPlain ? propertyName(property["key"]) : undefined;
    const value = isPlain && typeof name === "string" ? literalValue(property["value"]) : NOT_LITERAL;
    if (typeof name !== "string" || value === NOT_LITERAL) return NOT_LITERAL;
    entries.push([name, value]);
  }
  return Object.fromEntries(entries);
};

/** A font loader a module imports: which, and under the name it exports (`Inter`, `default`). */
type ImportedLoader = { readonly loader: FontLoader; readonly imported: string };

/**
 * The loader an import declaration imports, or none for one that imports no font loader.
 *
 * @param statement - a statement of the module.
 */
const importedLoader = (statement: unknown): FontLoader | undefined => {
  if (!isRecord(statement) || statement["type"] !== "ImportDeclaration") return undefined;
  const source = statement["source"];
  return isRecord(source) && typeof source["value"] === "string"
    ? LOADER_MODULES[source["value"]]
    : undefined;
};

/**
 * The local names an import of a loader gives, each with what it imports.
 *
 * @param specifiers - the import's specifiers.
 * @param loader - the loader.
 */
const localNames = (specifiers: readonly unknown[], loader: FontLoader): [string, ImportedLoader][] =>
  specifiers.flatMap((specifier): [string, ImportedLoader][] => {
    if (!isRecord(specifier) || !isRecord(specifier["local"])) return [];
    const local = specifier["local"]["name"];
    const importedNode = specifier["imported"];
    const imported = isRecord(importedNode) ? (importedNode["name"] ?? importedNode["value"]) : "default";
    return typeof local === "string" && typeof imported === "string" ? [[local, { loader, imported }]] : [];
  });

/**
 * The local names a module gives the font loaders it imports, and where the imports are.
 *
 * @param body - the module's statements.
 */
const loaderImports = (
  body: readonly unknown[]
): {
  readonly names: ReadonlyMap<string, ImportedLoader>;
  readonly ranges: { readonly start: number; readonly end: number }[];
} => {
  const names = new Map<string, ImportedLoader>();
  const ranges: { readonly start: number; readonly end: number }[] = [];
  for (const statement of body) {
    const loader = importedLoader(statement);
    if (loader === undefined || !isRecord(statement) || !Array.isArray(statement["specifiers"])) continue;
    const { start, end } = statement;
    if (typeof start === "number" && typeof end === "number") ranges.push({ start, end });
    for (const [local, imported] of localNames(statement["specifiers"], loader)) names.set(local, imported);
  }
  return { names, ranges };
};

/**
 * Every node of a syntax tree, each with the node that holds it.
 *
 * @param node - the root.
 * @param parent - the node that holds it.
 */
const nodes = function* (
  node: unknown,
  parent: unknown
): Generator<{ readonly node: Readonly<Record<string, unknown>>; readonly parent: unknown }> {
  if (Array.isArray(node)) {
    for (const item of node) yield* nodes(item, parent);
    return;
  }
  if (!isRecord(node) || typeof node["type"] !== "string") return;
  yield { node, parent };
  for (const [key, value] of Object.entries(node)) {
    if (key !== "type" && typeof value === "object" && value !== null) yield* nodes(value, node);
  }
};

/**
 * A call of a font loader, or why its options cannot be read, or none for a node that calls no loader.
 *
 * @param node - a node of the module.
 * @param parent - the node that holds it.
 * @param names - the loaders, by the local names the module gives them.
 */
const fontCallOf = (
  node: Readonly<Record<string, unknown>>,
  parent: unknown,
  names: ReadonlyMap<string, ImportedLoader>
): FontCall | string | undefined => {
  if (node["type"] !== "CallExpression") return undefined;
  const callee = node["callee"];
  const named =
    isRecord(callee) && typeof callee["name"] === "string" ? names.get(callee["name"]) : undefined;
  const { start, end } = node;
  if (named === undefined || typeof start !== "number" || typeof end !== "number") return undefined;
  const argumentsList = node["arguments"];
  const options =
    Array.isArray(argumentsList) && argumentsList.length > 0 ? literalValue(argumentsList[0]) : {};
  if (!isRecord(options))
    return `${named.imported}(…): its options must be written as literals, as Next.js requires`;
  const declarator = isRecord(parent) && parent["type"] === "VariableDeclarator" ? parent["id"] : undefined;
  return {
    loader: named.loader,
    family: named.loader === "google" ? named.imported.replaceAll("_", " ") : undefined,
    variable: isRecord(declarator) && typeof declarator["name"] === "string" ? declarator["name"] : undefined,
    options,
    start,
    end
  };
};

/**
 * The calls of `next/font` in a module.
 *
 * @param code - the module's text.
 * @param file - its path, which tells the parser its syntax (`.tsx`).
 */
export const findFontCalls = (code: string, file: string): FontModuleCalls => {
  const parsed = parseSync(file, code);
  const { names, ranges } = loaderImports(parsed.program.body);
  if (names.size === 0) return { calls: [], imports: [], problems: [] };
  const calls: FontCall[] = [];
  const problems: string[] = [];
  for (const { node, parent } of nodes(parsed.program.body, undefined)) {
    const call = fontCallOf(node, parent, names);
    if (typeof call === "string") problems.push(call);
    else if (call !== undefined) calls.push(call);
  }
  return { calls, imports: ranges, problems };
};

/**
 * A module with its font calls replaced by the fonts' modules: each import of `next/font` becomes the imports of the
 * fonts, each call the font's import. The lines stay where they were.
 *
 * @param code - the module's text.
 * @param found - its calls and imports.
 * @param moduleIds - each call's font module, in the calls' order.
 */
export const replaceFontCalls = (
  code: string,
  found: FontModuleCalls,
  moduleIds: readonly string[]
): string => {
  const names = moduleIds.map((_, index) => `__forgebookFont${index}`);
  const imports = names
    .map((name, index) => `import ${name} from ${JSON.stringify(moduleIds[index])};`)
    .join(" ");
  const edits = [
    ...found.imports.map((range, index) => ({ ...range, text: index === 0 ? imports : "" })),
    ...found.calls.map((call, index) => ({
      start: call.start,
      end: call.end,
      text: names[index] ?? "undefined"
    }))
  ].sort((first, second) => second.start - first.start);
  let text = code;
  for (const edit of edits) {
    // the newlines the replaced text held stay, so every line after it keeps its number
    const lines = code.slice(edit.start, edit.end).split("\n").length - 1;
    text = `${text.slice(0, edit.start)}${edit.text}${"\n".repeat(lines)}${text.slice(edit.end)}`;
  }
  return text;
};
