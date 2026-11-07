/**
 * The tokens a Tailwind configuration file writes, read from its text and never run.
 *
 * @remarks
 * Pure. Running a project's configuration would run its code, which a read-only question must not do, so what is written
 * plainly is read (objects, strings, a constant of the same file) and what needs code to know (a spread of something
 * imported, a function, a plugin) is named in `unread`: a token this cannot see is a value that reads as hand-written.
 * Each theme key is named as Tailwind 4 names it (`colors.primary.DEFAULT` is `--color-primary`), so one project reads
 * the same in either version and a token's utility comes from its name alike.
 *
 * @module
 */
import { type ESTree, parseSync } from "vite";

import { keyName, propertyValue, unwrapped } from "./indexFields.ts";

/** A theme value the file writes. */
export type ConfigToken = {
  /** Its name, as Tailwind 4 names it. */
  readonly name: string;
  /** Its value. */
  readonly value: string;
  /** Its type, from the theme key that holds it. */
  readonly type: string;
};

/** What a configuration file gives. */
export type TailwindConfigReading = {
  /** Its tokens. */
  readonly tokens: readonly ConfigToken[];
  /** What cannot be read without running it, one line each. */
  readonly unread: readonly string[];
  /** The modules its `presets` name, to read in turn. */
  readonly presets: readonly string[];
  /** The theme keys it replaces rather than extends: Tailwind's defaults for these do not apply. */
  readonly replaced: readonly string[];
  /** How it reaches Tailwind's default palette by name (`colors.blue` from `tailwindcss/colors`). */
  readonly paletteAliases: readonly { readonly name: string; readonly palette: string }[];
};

/** The theme keys that hold tokens, with their namespace and type. */
const THEME_KEYS: Readonly<Record<string, { readonly prefix: string; readonly type: string }>> = {
  colors: { prefix: "--color-", type: "color" },
  backgroundColor: { prefix: "--color-", type: "color" },
  textColor: { prefix: "--color-", type: "color" },
  borderColor: { prefix: "--color-", type: "color" },
  spacing: { prefix: "--spacing-", type: "dimension" },
  borderRadius: { prefix: "--radius-", type: "dimension" },
  fontSize: { prefix: "--text-", type: "dimension" },
  fontFamily: { prefix: "--font-", type: "fontFamily" },
  fontWeight: { prefix: "--font-weight-", type: "fontWeight" },
  lineHeight: { prefix: "--leading-", type: "number" },
  letterSpacing: { prefix: "--tracking-", type: "tracking" },
  boxShadow: { prefix: "--shadow-", type: "shadow" },
  screens: { prefix: "--breakpoint-", type: "breakpoint" }
};

/** Words the values of a palette are never given as, in `tailwindcss/colors`. */
const NOT_A_TOKEN = new Set(["inherit", "currentColor", "current"]);

/** What walking a file's objects keeps. */
type Walk = {
  readonly tokens: ConfigToken[];
  readonly unread: string[];
  readonly paletteAliases: { name: string; palette: string }[];
  /** The file's top-level constants. */
  readonly constants: ReadonlyMap<string, ESTree.Expression>;
  /** The names bound to `tailwindcss/colors`. */
  readonly palettes: ReadonlySet<string>;
};

/** A string's text, a template with nothing in it included. */
const stringOf = (node: ESTree.Expression): string | undefined => {
  if (node.type === "Literal") return typeof node.value === "string" ? node.value : undefined;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0)
    return node.quasis[0]?.value.cooked ?? undefined;
  return undefined;
};

/** A leaf's text: a string, a number, or a list's first (`fontSize: ["1rem", { lineHeight: … }]`) or all (a font stack). */
const leafOf = (node: ESTree.Expression, type: string): string | undefined => {
  const text = stringOf(node);
  if (text !== undefined) return text;
  if (node.type === "Literal" && typeof node.value === "number") return String(node.value);
  if (node.type !== "ArrayExpression") return undefined;
  const parts = node.elements.flatMap((element) =>
    element === null || element.type === "SpreadElement" ? [] : (stringOf(unwrapped(element)) ?? [])
  );
  return type === "fontFamily" ? parts.join(", ") : parts[0];
};

/** The palette a member expression names (`colors.blue`, `colors.blue[500]`), when its object is `tailwindcss/colors`. */
const paletteOf = (value: ESTree.Expression, walk: Walk): string | undefined => {
  if (value.type !== "MemberExpression") return undefined;
  const { object, property, computed } = value;
  if (computed) {
    const inner = paletteOf(object, walk);
    return inner !== undefined && property.type === "Literal"
      ? `${inner}-${String(property.value)}`
      : undefined;
  }
  return object.type === "Identifier" && walk.palettes.has(object.name) && property.type === "Identifier"
    ? property.name
    : undefined;
};

/** Reads each key of an object under a name; `DEFAULT` is the name itself. */
const walkObject = (
  object: ESTree.ObjectExpression,
  name: string,
  { type, label }: { readonly type: string; readonly label: string },
  walk: Walk
): void => {
  for (const property of object.properties) {
    const key = property.type !== "Property" || property.computed ? undefined : keyName(property.key);
    if (property.type !== "Property" || key === undefined) {
      walk.unread.push(`${label}: a part is built by code`);
      continue;
    }
    const child = key === "DEFAULT" ? name : `${name}-${key}`;
    walkValue(property.value, child, { type, label: `${label}.${key}` }, walk);
  }
};

/** Reads a theme value under a name: an object of more names, a leaf, or something that needs running. */
const walkValue = (
  node: ESTree.Expression,
  name: string,
  place: { readonly type: string; readonly label: string },
  walk: Walk
): void => {
  const value = unwrapped(node);
  const constant = value.type === "Identifier" ? walk.constants.get(value.name) : undefined;
  if (constant !== undefined) {
    walkValue(constant, name, place, walk);
    return;
  }
  const palette = paletteOf(value, walk);
  if (palette !== undefined) {
    walk.paletteAliases.push({ name, palette });
    return;
  }
  if (value.type === "ObjectExpression") {
    walkObject(value, name, place, walk);
    return;
  }
  const leaf = leafOf(value, place.type);
  if (leaf === undefined) walk.unread.push(`${place.label}: built by code`);
  else if (!NOT_A_TOKEN.has(leaf)) walk.tokens.push({ name, value: leaf, type: place.type });
};

/** Reads one `theme` or `theme.extend` object, naming the keys it holds. */
const walkTheme = (theme: ESTree.ObjectExpression, label: string, walk: Walk): string[] => {
  const held: string[] = [];
  for (const property of theme.properties) {
    if (property.type !== "Property" || property.computed) {
      walk.unread.push(`${label}: a part is built by code`);
      continue;
    }
    const key = keyName(property.key);
    const known = key === undefined ? undefined : THEME_KEYS[key];
    if (key === undefined || key === "extend") continue;
    held.push(key);
    if (known === undefined) continue;
    const value = unwrapped(property.value);
    const prefix = known.prefix.slice(0, -1);
    if (value.type === "ObjectExpression" || value.type === "Identifier") {
      walkEntries(value, prefix, { type: known.type, label: `${label}.${key}` }, walk);
    } else {
      walk.unread.push(`${label}.${key}: built by code`);
    }
  }
  return held;
};

/** Reads a theme key's object: each of its keys under the namespace. */
const walkEntries = (
  node: ESTree.Expression,
  prefix: string,
  place: { readonly type: string; readonly label: string },
  walk: Walk
): void => {
  const value = node.type === "Identifier" ? (walk.constants.get(node.name) ?? node) : node;
  if (value.type === "ObjectExpression") walkObject(value, prefix, place, walk);
  else walk.unread.push(`${place.label}: built by code`);
};

/** A top-level `const x = …`'s name and value. */
const constantsOf = (program: ESTree.Program): Map<string, ESTree.Expression> => {
  const constants = new Map<string, ESTree.Expression>();
  for (const statement of program.body) {
    const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (declaration?.type !== "VariableDeclaration") continue;
    for (const { id, init } of declaration.declarations) {
      if (id.type === "Identifier" && init !== null) constants.set(id.name, unwrapped(init));
    }
  }
  return constants;
};

/** The module a `require("x")` names, when the expression is one. */
const requiredModule = (node: ESTree.Expression): string | undefined => {
  const call = unwrapped(node);
  if (call.type !== "CallExpression" || call.callee.type !== "Identifier" || call.callee.name !== "require")
    return undefined;
  const [first] = call.arguments;
  return first === undefined || first.type === "SpreadElement" ? undefined : stringOf(unwrapped(first));
};

/** Each name's module, from the file's imports and `require`s. */
const importsOf = (
  program: ESTree.Program,
  constants: ReadonlyMap<string, ESTree.Expression>
): Map<string, string> => {
  const imports = new Map<string, string>();
  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration") continue;
    for (const specifier of statement.specifiers) {
      if (specifier.type !== "ImportSpecifier")
        imports.set(specifier.local.name, String(statement.source.value));
    }
  }
  for (const [name, value] of constants) {
    const module = requiredModule(value);
    if (module !== undefined) imports.set(name, module);
  }
  return imports;
};

/** The object a file exports, through a helper's call (`defineConfig({…})`) and a constant. */
const exportedObject = (
  program: ESTree.Program,
  constants: ReadonlyMap<string, ESTree.Expression>
): ESTree.ObjectExpression | undefined => {
  const plain = (node: ESTree.Expression): ESTree.ObjectExpression | undefined => {
    const value = unwrapped(node);
    if (value.type === "ObjectExpression") return value;
    if (value.type === "Identifier") {
      const constant = constants.get(value.name);
      return constant === undefined ? undefined : plain(constant);
    }
    if (value.type === "CallExpression") {
      const [first] = value.arguments;
      return first === undefined || first.type === "SpreadElement" ? undefined : plain(first);
    }
    return undefined;
  };
  for (const statement of program.body) {
    if (statement.type === "ExportDefaultDeclaration") {
      const { declaration } = statement;
      return declaration.type === "FunctionDeclaration" ||
        declaration.type === "ClassDeclaration" ||
        declaration.type === "TSInterfaceDeclaration"
        ? undefined
        : plain(declaration);
    }
    if (
      statement.type === "ExpressionStatement" &&
      statement.expression.type === "AssignmentExpression" &&
      statement.expression.left.type === "MemberExpression" &&
      statement.expression.left.object.type === "Identifier" &&
      statement.expression.left.object.name === "module"
    ) {
      return plain(statement.expression.right);
    }
  }
  return undefined;
};

/** The modules a `presets` list names. */
const presetsOf = (
  object: ESTree.ObjectExpression,
  imports: ReadonlyMap<string, string>,
  unread: string[]
): string[] => {
  const list = propertyValue(object, "presets");
  if (list === undefined) return [];
  if (list.type !== "ArrayExpression") {
    unread.push("presets: built by code");
    return [];
  }
  return list.elements.flatMap((element): string[] => {
    if (element === null || element.type === "SpreadElement") {
      unread.push("presets: a part is built by code");
      return [];
    }
    const value = unwrapped(element);
    const module =
      requiredModule(value) ?? (value.type === "Identifier" ? imports.get(value.name) : undefined);
    if (module === undefined) unread.push("presets: a part is built by code");
    return module === undefined ? [] : [module];
  });
};

/**
 * Reads a Tailwind configuration's text.
 *
 * @param file - its path, for the parser (its extension says TypeScript).
 * @param text - its text.
 */
export const readTailwindConfig = (file: string, text: string): TailwindConfigReading => {
  const empty = { tokens: [], presets: [], replaced: [], paletteAliases: [] };
  const { program, errors } = parseSync(file, text);
  if (errors.length > 0) return { ...empty, unread: [`it cannot be parsed: ${errors[0]?.message ?? ""}`] };
  const constants = constantsOf(program);
  const object = exportedObject(program, constants);
  if (object === undefined) return { ...empty, unread: ["what it exports is built by code"] };
  const imports = importsOf(program, constants);
  const palettes = new Set(
    [...imports].flatMap(([name, module]) => (module === "tailwindcss/colors" ? [name] : []))
  );
  const walk: Walk = { tokens: [], unread: [], paletteAliases: [], constants, palettes };
  const presets = presetsOf(object, imports, walk.unread);
  const written = propertyValue(object, "theme");
  // `{ theme }`, with a constant of the file above it
  const theme = written?.type === "Identifier" ? (constants.get(written.name) ?? written) : written;
  if (theme === undefined) return { ...empty, presets, unread: walk.unread };
  if (theme.type !== "ObjectExpression") {
    return { ...empty, presets, unread: [...walk.unread, "theme: built by code"] };
  }
  const replaced = walkTheme(theme, "theme", walk);
  const writtenExtend = propertyValue(theme, "extend");
  const extend =
    writtenExtend?.type === "Identifier"
      ? (constants.get(writtenExtend.name) ?? writtenExtend)
      : writtenExtend;
  if (extend?.type === "ObjectExpression") walkTheme(extend, "theme.extend", walk);
  else if (extend !== undefined) walk.unread.push("theme.extend: built by code");
  return {
    tokens: walk.tokens,
    unread: walk.unread,
    presets,
    replaced,
    paletteAliases: walk.paletteAliases
  };
};

/**
 * The colours of Tailwind's default palette, from the text of `tailwindcss/lib/public/colors.js`: only an object of
 * plain strings, read and not run, as any other file here.
 *
 * @param file - its path.
 * @param text - its text.
 * @returns each colour's name as Tailwind 4 names it, with its value.
 */
export const readTailwindPalette = (file: string, text: string): ConfigToken[] => {
  const { program, errors } = parseSync(file, text);
  if (errors.length > 0) return [];
  const palette = constantsOf(program).get("_default");
  if (palette?.type !== "ObjectExpression") return [];
  const walk: Walk = {
    tokens: [],
    unread: [],
    paletteAliases: [],
    constants: new Map(),
    palettes: new Set()
  };
  walkEntries(palette, "--color", { type: "color", label: "palette" }, walk);
  return walk.tokens;
};
