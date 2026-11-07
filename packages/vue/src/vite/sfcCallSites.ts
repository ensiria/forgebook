/**
 * Where an application draws a single-file component, read from its templates (no code runs): each element of another
 * `.vue` file that imports the component, with the props it gives a literal value. `forgebook new` takes its values from
 * them, so a first story shows the component as the application uses it.
 *
 * @remarks
 * The package's `.vue` files are read, outside `node_modules`, builds and hidden folders. An import is followed when it
 * is relative or goes through the nearest `tsconfig.json`'s `paths`; a component registered globally is not found. A
 * static attribute is a string, a bare one `true`, a `:prop` binding is kept when its expression is a literal (the
 * core's `literalExpressionCode`), and a default slot of plain text is `#default`. Kebab-case names are read as the camelCase props
 * they bind.
 *
 * @module
 */
import { type Dirent, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import type { CallSite, ExtractCallSites } from "forgebook/vite/adapter";
import { literalExpressionCode } from "forgebook/vite/jsx-call-sites";
import ts from "typescript-6";
import { parse } from "vue/compiler-sfc";

/** How many `.vue` files are read at most, and how large one may be: a package's root may be far wider than its app. */
const MAX_FILES = 5000;
const MAX_FILE_BYTES = 1_000_000;

/** Folders that hold no application source. */
const SKIPPED_FOLDERS = new Set(["node_modules", "dist", "build", "coverage"]);

/** A file that is not the application. */
const NOT_APPLICATION = /\.(?:stories|story|test|spec)\.vue$/;

/** A template node, as far as this reads it. */
type TemplateNode = {
  readonly type: number;
  readonly tag?: string;
  readonly content?: string;
  readonly props?: readonly TemplateProp[];
  readonly children?: readonly TemplateNode[];
};

/** An attribute (type 6) or a directive (type 7) of an element. */
type TemplateProp = {
  readonly type: number;
  readonly name: string;
  readonly value?: { readonly content: string };
  readonly arg?: { readonly content: string; readonly isStatic: boolean };
  readonly exp?: { readonly content: string };
};

/** Whether a value is one of Vue's template props, as far as this reads them. */
const isTemplateProp = (value: unknown): value is TemplateProp =>
  typeof value === "object" && value !== null && "type" in value && "name" in value;

/** A node of Vue's template tree, as the few fields this reads: the compiler's own types are a union of every kind. */
const templateNode = (node: object): TemplateNode => {
  const fields = new Map<string, unknown>(Object.entries(node));
  const type = fields.get("type");
  const tag = fields.get("tag");
  const content = fields.get("content");
  const props = fields.get("props");
  const children = fields.get("children");
  return {
    type: typeof type === "number" ? type : 0,
    ...(typeof tag === "string" ? { tag } : {}),
    ...(typeof content === "string" ? { content } : {}),
    ...(Array.isArray(props) ? { props: props.filter(isTemplateProp) } : {}),
    ...(Array.isArray(children)
      ? {
          children: children
            .filter((child): child is object => typeof child === "object" && child !== null)
            .map(templateNode)
        }
      : {})
  };
};

/** Vue's node kinds that this reads. */
const ELEMENT = 1;
const TEXT = 2;
const ATTRIBUTE = 6;
const DIRECTIVE = 7;

/** A kebab-case name as the camelCase prop it binds (`max-length` → `maxLength`). */
const camel = (name: string): string =>
  name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

/** A folder's entries; none when it may not be read, since such a folder holds nothing it can use. */
const entriesOf = (dir: string): Dirent[] => {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
};

/** Whether an entry is passed over: hidden, a build or dependencies, or a link, which may lead out of the package. */
const isSkipped = (entry: Dirent): boolean =>
  entry.name.startsWith(".") || SKIPPED_FOLDERS.has(entry.name) || entry.isSymbolicLink();

/** The `.vue` files under a folder, at most `MAX_FILES`. */
const vueFiles = (folder: string): string[] => {
  const found: string[] = [];
  const folders = [folder];
  while (folders.length > 0 && found.length < MAX_FILES) {
    const dir = folders.pop() ?? "";
    for (const entry of entriesOf(dir).filter((each) => !isSkipped(each))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) folders.push(path);
      else if (entry.name.endsWith(".vue") && !NOT_APPLICATION.test(entry.name)) found.push(path);
    }
  }
  return found.slice(0, MAX_FILES).sort();
};

/** The nearest folder above a file that holds the named file. */
const nearest = (file: string, name: string): string | undefined => {
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    if (existsSync(join(dir, name))) return dir;
    if (dirname(dir) === dir) return undefined;
  }
};

/** The `paths` of the nearest `tsconfig.json`, as prefixes to replace, absolute. */
const pathPrefixes = (file: string): readonly (readonly [string, string])[] => {
  const dir = nearest(file, "tsconfig.json");
  if (dir === undefined) return [];
  const read = ts.getParsedCommandLineOfConfigFile(join(dir, "tsconfig.json"), undefined, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: () => undefined
  });
  const paths = read?.options.paths ?? {};
  const base = read?.options.baseUrl ?? read?.options["pathsBasePath"];
  const from = typeof base === "string" ? base : dir;
  return Object.entries(paths).flatMap(([pattern, targets]) => {
    const target = targets[0];
    if (!pattern.endsWith("*") || target === undefined || !target.endsWith("*")) return [];
    return [[pattern.slice(0, -1), resolve(from, target.slice(0, -1))] as const];
  });
};

/** The file an import names: relative to the importing file, or through a `paths` prefix; none for a package. */
const importedPath = (
  specifier: string,
  sfc: string,
  prefixes: readonly (readonly [string, string])[]
): string | undefined => {
  if (specifier.startsWith(".")) return resolve(dirname(sfc), specifier);
  const prefix = prefixes.find(([from]) => specifier.startsWith(from));
  return prefix === undefined ? undefined : join(prefix[1], specifier.slice(prefix[0].length));
};

/** The local names a file's scripts import the component by. */
const importedNames = (
  scripts: string,
  sfc: string,
  component: string,
  prefixes: readonly (readonly [string, string])[]
): Set<string> => {
  const names = new Set<string>();
  const source = ts.createSourceFile("script.ts", scripts, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const local = statement.importClause?.name?.text;
    if (local === undefined) continue;
    const specifier = statement.moduleSpecifier.text;
    const path = importedPath(specifier, sfc, prefixes);
    if (path === component || `${path}.vue` === component) names.add(local);
  }
  return names;
};

/** A binding's expression as code, when it is a literal. */
const bindingCode = (expression: string): string | undefined => {
  const source = ts.createSourceFile("binding.ts", `(${expression});`, ts.ScriptTarget.Latest, false);
  const [statement] = source.statements;
  return statement !== undefined && ts.isExpressionStatement(statement)
    ? literalExpressionCode(statement.expression)
    : undefined;
};

/** A prop's name and value as code, when it is a static attribute or a `:prop` bound to a literal. */
const propArg = (prop: TemplateProp): readonly [string, string] | undefined => {
  if (prop.type === ATTRIBUTE && prop.name !== "class" && prop.name !== "style")
    return [camel(prop.name), prop.value === undefined ? "true" : JSON.stringify(prop.value.content)];
  const isBound = prop.type === DIRECTIVE && prop.name === "bind" && prop.arg?.isStatic === true;
  if (!isBound || prop.arg === undefined || prop.exp === undefined) return undefined;
  const code = bindingCode(prop.exp.content);
  return code === undefined ? undefined : [camel(prop.arg.content), code];
};

/** An element's default slot when it is plain text, as code. */
const slotText = (element: TemplateNode): string | undefined => {
  const children = element.children ?? [];
  if (children.length === 0 || !children.every((child) => child.type === TEXT)) return undefined;
  const text = children
    .map((child) => child.content ?? "")
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return text === "" ? undefined : JSON.stringify(text);
};

/** The props an element gives a literal value, and its plain-text default slot. */
const argsOf = (element: TemplateNode): Record<string, string> => {
  const args: Record<string, string> = {};
  for (const prop of element.props ?? []) {
    const arg = propArg(prop);
    if (arg !== undefined) args[arg[0]] = arg[1];
  }
  const text = slotText(element);
  if (text !== undefined) args["#default"] = text;
  return args;
};

/** A file's parsed blocks; none when it cannot be read or parsed, which leaves it out. */
const descriptorOf = (sfc: string): ReturnType<typeof parse>["descriptor"] | undefined => {
  try {
    return parse(readFileSync(sfc, "utf8"), { filename: sfc }).descriptor;
  } catch {
    return undefined;
  }
};

/**
 * Where the application draws a single-file component.
 *
 * @param file - the component's `.vue` file, absolute.
 * @returns the call sites; a message when the file is not a single-file component in a package.
 */
export const sfcCallSites: ExtractCallSites = (file: string): readonly CallSite[] | string => {
  if (!file.endsWith(".vue")) return `${file} is not a single-file component`;
  const packageDir = nearest(file, "package.json");
  if (packageDir === undefined) return `${file} is in no package`;
  const prefixes = pathPrefixes(file);
  const sites: CallSite[] = [];
  for (const sfc of vueFiles(packageDir)) {
    if (sfc === file || statSync(sfc).size > MAX_FILE_BYTES) continue;
    const descriptor = descriptorOf(sfc);
    if (descriptor === undefined) continue;
    const scripts = [descriptor.script?.content ?? "", descriptor.scriptSetup?.content ?? ""].join("\n");
    const names = importedNames(scripts, sfc, file, prefixes);
    const ast = descriptor.template?.ast;
    if (names.size === 0 || ast === undefined) continue;
    const tags = new Set(
      [...names].flatMap((name) => [name, name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()])
    );
    const visit = (node: TemplateNode): void => {
      if (node.type === ELEMENT && node.tag !== undefined && tags.has(node.tag))
        sites.push({ file: sfc, args: argsOf(node) });
      for (const child of node.children ?? []) visit(child);
    };
    visit(templateNode(ast));
  }
  return sites;
};
