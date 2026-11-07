/**
 * The components a project's files declare, read from their text: their names, what they render at their root, the props
 * they take and the classes they carry.
 *
 * @remarks
 * Pure, and read without a type checker: this has to work on a project with no catalogue, in a moment, over every file.
 *
 * @module
 */
import { createHash } from "node:crypto";

import { type ESTree, parseSync } from "vite";

import type { UsageGuidance } from "../componentDocs.ts";
import { LEFT_ALONE } from "./checkCode.ts";
import { type ComponentRules, rulesOfTags } from "./componentRules.ts";
import type { ProjectFile } from "./projectFiles.ts";
import { singleFileComponent } from "./singleFileComponent.ts";
import { isTooDeep, lineAt, lineStarts } from "./sourceText.ts";
import { guidanceOfTags, tagsOfComment } from "./usageGuidance.ts";

/** A component, as far as its file says. */
export type ScannedComponent = {
  /** Its name. */
  readonly name: string;
  /** Its file, relative to the project. */
  readonly file: string;
  /** Its line, from 1. */
  readonly line: number;
  /** What it renders at its root (`button`, `Slot`); none when that takes running it. */
  readonly root?: string;
  /** The props it takes, when written plainly. */
  readonly props: readonly string[];
  /** The classes on its root, when written plainly. */
  readonly classes: readonly string[];
  /** The components it renders. */
  readonly renders: readonly string[];
  /** When to use it and when not, from its documentation comment. */
  readonly guidance?: UsageGuidance;
  /** How it is chosen and how it fits with others, from its documentation comment or a file beside it. */
  readonly rules?: ComponentRules;
  /** Whether its file exports it, so something else can use it. */
  readonly isExported: boolean;
  /** Whether it is its file's default export. */
  readonly isDefault?: boolean;
  /** Its code with no spacing and its own name out, to tell a copy; none when too short to tell anything. */
  readonly code?: string;
};

/** How many line comments may stand between a doc comment and what it documents. */
const MOST_COMMENTS_BACK = 3;

/** Shorter than this, two components' code being equal says nothing: every wrapper of a `div` reads alike. */
const SHORTEST_CODE = 120;

/** A file that can declare components. */
export const COMPONENT_FILE = /\.(?:tsx|jsx|vue|svelte|astro)$/;

/** A framework's own single-file component. */
const SINGLE_FILE = /\.(?:vue|svelte|astro)$/;

/** Whether a value is a node of the syntax tree. */
const isNode = (value: unknown): value is { readonly type: string } & Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && "type" in value && typeof value.type === "string";

/** Visits a node and everything under it, until the visit says it found what it wanted. */
const someNode = (
  node: unknown,
  visit: (each: { readonly type: string } & Readonly<Record<string, unknown>>) => boolean
): boolean => {
  if (Array.isArray(node)) return node.some((each) => someNode(each, visit));
  if (typeof node !== "object" || node === null) return false;
  if (isNode(node) && visit(node)) return true;
  return Object.values(node).some((value) => typeof value === "object" && someNode(value, visit));
};

/** A JSX element's name: `button`, `Dialog`, `Dialog.Title`. */
const elementName = (name: unknown): string | undefined => {
  if (!isNode(name)) return undefined;
  if (name.type === "JSXIdentifier" && typeof name["name"] === "string") return name["name"];
  if (name.type !== "JSXMemberExpression") return undefined;
  const [object, property] = [elementName(name["object"]), elementName(name["property"])];
  return object === undefined || property === undefined ? undefined : `${object}.${property}`;
};

/** The classes of a `className` or `class` attribute, as a string or as a string in a helper's call. */
const classesOfAttribute = (value: unknown): readonly string[] => {
  // the longest string: `cn(isOn && "on", "a b c")` holds the look in its second
  let text = "";
  someNode(value, (node) => {
    if (node.type === "Literal" && typeof node["value"] === "string" && node["value"].length > text.length) {
      text = node["value"];
    }
    return false;
  });
  return text.split(/\s+/).filter((each) => each !== "");
};

/** The classes on a JSX element. */
const classesOfElement = (element: Readonly<Record<string, unknown>>): readonly string[] => {
  const attributes: readonly unknown[] = Array.isArray(element["attributes"]) ? element["attributes"] : [];
  const found = attributes.find((attribute) => {
    const key = isNode(attribute) && isNode(attribute["name"]) ? attribute["name"]["name"] : undefined;
    return key === "className" || key === "class";
  });
  return isNode(found) ? classesOfAttribute(found["value"]) : [];
};

/** Whether a node opens a function of its own, whose returns are not its parent's. */
const isFunctionNode = (node: { readonly type: string }): boolean =>
  node.type === "ArrowFunctionExpression" ||
  node.type === "FunctionExpression" ||
  node.type === "FunctionDeclaration";

/** What a function's own returns give, in order, not those of the callbacks inside it. */
const returnedValues = (node: unknown): unknown[] => {
  if (Array.isArray(node)) return node.flatMap(returnedValues);
  if (typeof node !== "object" || node === null) return [];
  if (isNode(node)) {
    if (isFunctionNode(node)) return [];
    if (node.type === "ReturnStatement") return [node["argument"]];
  }
  return Object.values(node).flatMap((value) => (typeof value === "object" ? returnedValues(value) : []));
};

/** The element an expression comes to: through parentheses, a condition's last branch and a fragment's first child. */
const elementIn = (
  value: unknown
): (Readonly<Record<string, unknown>> & { readonly type: string }) | undefined => {
  if (!isNode(value)) return undefined;
  if (value.type === "JSXElement")
    return isNode(value["openingElement"]) ? value["openingElement"] : undefined;
  if (value.type === "ParenthesizedExpression") return elementIn(value["expression"]);
  if (value.type === "ConditionalExpression")
    return elementIn(value["alternate"]) ?? elementIn(value["consequent"]);
  if (value.type === "LogicalExpression") return elementIn(value["right"]);
  if (value.type !== "JSXFragment" || !Array.isArray(value["children"])) return undefined;
  for (const child of value["children"]) {
    const found = elementIn(child);
    if (found !== undefined) return found;
  }
  return undefined;
};

/** What a function renders at its root: what it returns last, since an early return is a loading or an empty state. */
const rootOf = (
  body: unknown
): (Readonly<Record<string, unknown>> & { readonly type: string }) | undefined => {
  if (!isNode(body) || body.type !== "BlockStatement") return elementIn(body);
  return returnedValues(body["body"])
    .flatMap((value) => elementIn(value) ?? [])
    .at(-1);
};

/** What a function renders: its root, its root's classes, and every component in it. */
const rendered = (
  body: unknown
): Pick<ScannedComponent, "root" | "classes" | "renders"> & { readonly hasMarkup?: boolean } => {
  const renders = new Set<string>();
  let hasMarkup = false;
  someNode(body, (node) => {
    const name = node.type === "JSXOpeningElement" ? elementName(node["name"]) : undefined;
    if (name === undefined) return false;
    hasMarkup = true;
    if (/^[A-Z]/.test(name)) renders.add(name);
    return false;
  });
  const element = rootOf(body);
  const root = element === undefined ? undefined : elementName(element["name"]);
  return {
    ...(root === undefined ? {} : { root }),
    ...(hasMarkup ? { hasMarkup } : {}),
    classes: element === undefined ? [] : classesOfElement(element),
    renders: [...renders]
  };
};

/** The names a type's members give, for an object type or an interface's body. */
const memberNames = (members: readonly ESTree.TSSignature[]): string[] =>
  members.flatMap((member) =>
    member.type === "TSPropertySignature" && member.key.type === "Identifier" ? [member.key.name] : []
  );

/** The object types and interfaces a file declares at its top, by name. */
const declaredTypes = (program: ESTree.Program): ReadonlyMap<string, readonly string[]> => {
  const types = new Map<string, readonly string[]>();
  for (const statement of program.body) {
    const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (declaration?.type === "TSInterfaceDeclaration") {
      types.set(declaration.id.name, memberNames(declaration.body.body));
    } else if (
      declaration?.type === "TSTypeAliasDeclaration" &&
      declaration.typeAnnotation.type === "TSTypeLiteral"
    ) {
      types.set(declaration.id.name, memberNames(declaration.typeAnnotation.members));
    }
  }
  return types;
};

/** The props a function's first parameter takes: names it destructures, or its type's members. */
const propsOf = (parameter: unknown, types: ReadonlyMap<string, readonly string[]>): readonly string[] => {
  if (!isNode(parameter)) return [];
  const annotation = parameter["typeAnnotation"];
  const inner = isNode(annotation) ? annotation["typeAnnotation"] : undefined;
  if (isNode(inner) && inner.type === "TSTypeReference" && isNode(inner["typeName"])) {
    const named = types.get(String(inner["typeName"]["name"]));
    if (named !== undefined) return named;
  }
  if (isNode(inner) && inner.type === "TSTypeLiteral" && Array.isArray(inner["members"])) {
    return inner["members"].flatMap((member: unknown) =>
      isNode(member) && isNode(member["key"]) && typeof member["key"]["name"] === "string"
        ? [member["key"]["name"]]
        : []
    );
  }
  if (parameter.type !== "ObjectPattern" || !Array.isArray(parameter["properties"])) return [];
  return parameter["properties"].flatMap((property: unknown) =>
    isNode(property) && isNode(property["key"]) && typeof property["key"]["name"] === "string"
      ? [property["key"]["name"]]
      : []
  );
};

/** The function a declaration's value holds, through `forwardRef(…)` and `memo(…)`. */
const functionOf = (value: unknown): (Readonly<Record<string, unknown>> & { type: string }) | undefined => {
  if (!isNode(value)) return undefined;
  if (value.type === "ArrowFunctionExpression" || value.type === "FunctionExpression") return value;
  if (value.type === "FunctionDeclaration") return value;
  if (value.type === "CallExpression" && Array.isArray(value["arguments"])) {
    return functionOf(value["arguments"][0]);
  }
  return value.type === "TSAsExpression" || value.type === "TSSatisfiesExpression"
    ? functionOf(value["expression"])
    : undefined;
};

/** A function at a program's top, with what is known of it from outside. */
type TopFunction = {
  readonly name: string;
  readonly value: unknown;
  readonly start: number;
  /** A declaration's type (`React.FC<Props>`). */
  readonly annotation?: unknown;
  /** Where the statement starts, which its comment stands before. */
  readonly statement?: number;
  /** Whether the statement itself exports it. */
  readonly isTop?: boolean;
  /** Whether the statement is the default export. */
  readonly isDefaultStatement?: boolean;
};

/** A class component's `render`, as a function. */
const renderOfClass = (node: { readonly body?: unknown; readonly superClass?: unknown }): unknown => {
  const isComponent = isNode(node.superClass) && /Component$/.test(sourceName(node.superClass));
  if (!isComponent || !isNode(node.body) || !Array.isArray(node.body["body"])) return undefined;
  const render: unknown = node.body["body"].find(
    (member: unknown) => isNode(member) && isNode(member["key"]) && member["key"]["name"] === "render"
  );
  return isNode(render) ? render["value"] : undefined;
};

/** The last name of `React.Component` or `Component`. */
const sourceName = (node: { readonly type: string } & Readonly<Record<string, unknown>>): string => {
  if (node.type === "Identifier" && typeof node["name"] === "string") return node["name"];
  return isNode(node["property"]) ? sourceName(node["property"]) : "";
};

/** The top function one statement declares. */
const topFunctionsOf = (
  declaration:
    | ESTree.Statement
    | ESTree.Declaration
    | ESTree.Expression
    | ESTree.ExportDefaultDeclaration["declaration"],
  file: string,
  isDefault: boolean
): TopFunction[] => {
  const { start } = declaration;
  if (declaration.type === "FunctionDeclaration") {
    return [{ name: declaration.id?.name ?? nameOfFile(file), value: declaration, start }];
  }
  if (declaration.type === "ClassDeclaration") {
    const value = renderOfClass(declaration);
    return value === undefined ? [] : [{ name: declaration.id?.name ?? nameOfFile(file), value, start }];
  }
  if (isDefault && declaration.type === "CallExpression") {
    return [{ name: nameOfFile(file), value: declaration, start }];
  }
  if (declaration.type !== "VariableDeclaration") return [];
  return declaration.declarations.flatMap((each): TopFunction[] =>
    each.id.type === "Identifier"
      ? [{ name: each.id.name, value: each.init, start: each.start, annotation: each.id.typeAnnotation }]
      : []
  );
};

/** The named functions at a program's top; a default export with no name takes its file's. */
const topFunctions = (program: ESTree.Program, file: string): TopFunction[] =>
  program.body.flatMap((statement): TopFunction[] => {
    const isExport =
      statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration";
    const declaration = isExport ? statement.declaration : statement;
    return declaration === null || declaration === undefined
      ? []
      : topFunctionsOf(declaration, file, statement.type === "ExportDefaultDeclaration").map((each) => ({
          ...each,
          statement: statement.start,
          isTop: isExport,
          isDefaultStatement: statement.type === "ExportDefaultDeclaration"
        }));
  });

/** The type arguments of a type or a call, in order. */
const typeArgumentsOf = (node: unknown): readonly unknown[] => {
  if (!isNode(node) || !isNode(node["typeArguments"])) return [];
  const { params } = node["typeArguments"];
  return Array.isArray(params) ? params : [];
};

/** The type a component's props are written in, outside its parameter: `React.FC<P>`, `forwardRef<H, P>`. */
const typeOfValue = (value: unknown, annotation: unknown): unknown => {
  const declared = isNode(annotation) ? annotation["typeAnnotation"] : undefined;
  const [fromAnnotation] = typeArgumentsOf(declared);
  if (fromAnnotation !== undefined) return fromAnnotation;
  return typeArgumentsOf(value)[1];
};

/** The props a type's name or literal gives. */
const propsOfType = (type: unknown, types: ReadonlyMap<string, readonly string[]>): readonly string[] =>
  propsOf({ type: "Identifier", typeAnnotation: { type: "TSTypeAnnotation", typeAnnotation: type } }, types);

/**
 * A component's code as a copy of it would read: spacing and quotes do not matter, and neither does its name.
 *
 * @param source - its code.
 * @param name - its name.
 */
export const codeKey = (source: string, name: string): { readonly code?: string } => {
  const code = source.replaceAll(name, "").replace(/[\s;'"`]+/g, "");
  // a digest: a project's components are held in memory between questions
  return code.length < SHORTEST_CODE ? {} : { code: createHash("sha256").update(code).digest("base64url") };
};

/** What a file exports apart from the declarations themselves: `export { X }`, `export default X`. */
const exportedNames = (
  program: ESTree.Program
): { readonly named: ReadonlySet<string>; readonly byDefault: string | undefined } => {
  const named = new Set<string>();
  let byDefault: string | undefined;
  for (const statement of program.body) {
    if (statement.type === "ExportDefaultDeclaration" && statement.declaration.type === "Identifier") {
      byDefault = statement.declaration.name;
    }
    if (statement.type !== "ExportNamedDeclaration" || statement.source !== null) continue;
    for (const { local, exported } of statement.specifiers) {
      const [from, as] = [local, exported].map((each) =>
        "name" in each ? String(each.name) : String(each.value)
      );
      if (as === "default") byDefault = from;
      else if (from !== undefined) named.add(from);
    }
  }
  return { named, byDefault };
};

/** The names a file imports under another: rendering `Base` from `Button as Base` is rendering `Button`. */
const localImports = (program: ESTree.Program): ReadonlyMap<string, string> =>
  new Map(
    program.body.flatMap((statement) =>
      statement.type !== "ImportDeclaration"
        ? []
        : statement.specifiers.flatMap((each): [string, string][] =>
            each.type === "ImportSpecifier" && "name" in each.imported
              ? [[each.local.name, String(each.imported.name)]]
              : []
          )
    )
  );

/** The doc comment before a statement, past line comments between them (`// eslint-disable-next-line`). */
const commentBefore = (
  text: string,
  start: number,
  comments: ReadonlyMap<number, { readonly type: string; readonly value: string; readonly start: number }>
): string | undefined => {
  let at = start;
  for (let hops = 0; hops < MOST_COMMENTS_BACK; hops += 1) {
    let end = at;
    while (end > 0 && /\s/.test(text[end - 1] ?? "")) end -= 1;
    const comment = comments.get(end);
    if (comment === undefined) return undefined;
    if (comment.type === "Block") return comment.value;
    at = comment.start;
  }
  return undefined;
};

/**
 * When to use a component and when not, from a comment's text.
 *
 * @param comment - the comment; none gives nothing.
 */
export const guidanceOfComment = (
  comment: string | undefined
): { readonly guidance?: UsageGuidance; readonly rules?: ComponentRules } => {
  if (comment === undefined) return {};
  const tags = tagsOfComment(comment);
  const rules = rulesOfTags(tags);
  return { ...guidanceOfTags(tags), ...(rules === undefined ? {} : { rules }) };
};

/** What reading one function of a script needs of the rest of it. */
type ScriptContext = {
  readonly file: string;
  readonly text: string;
  readonly types: ReadonlyMap<string, readonly string[]>;
  readonly documented: ReadonlyMap<
    number,
    { readonly type: string; readonly value: string; readonly start: number }
  >;
  readonly starts: readonly number[];
  readonly exported: ReturnType<typeof exportedNames>;
  readonly imported: ReadonlyMap<string, string>;
};

/** Whether a value is a part of a library, as `SelectPrimitive.Root`. */
const isPartOfALibrary = (value: unknown): boolean =>
  isNode(value) &&
  value.type === "MemberExpression" &&
  isNode(value["object"]) &&
  value["object"].type === "Identifier" &&
  /^[A-Z]/.test(String(value["object"]["name"]));

/** A library's part given a name: `export const Select = SelectPrimitive.Root` has no markup, yet can carry rules. */
const partOfALibrary = (top: TopFunction, context: ScriptContext): ScannedComponent => ({
  name: top.name,
  file: context.file,
  line: lineAt(context.starts, top.start),
  props: [],
  classes: [],
  renders: [],
  isExported: top.isTop === true || context.exported.named.has(top.name),
  ...guidanceOfComment(commentBefore(context.text, top.statement ?? top.start, context.documented))
});

/** The component a function at a script's top is, when it is one: a capital name and markup of its own. */
const componentOf = (top: TopFunction, context: ScriptContext): ScannedComponent[] => {
  const { name, value, start, annotation, statement, isTop, isDefaultStatement } = top;
  const { file, text, types, documented, starts, exported, imported } = context;
  const found = functionOf(value);
  if (found === undefined && /^[A-Z]/.test(name) && isPartOfALibrary(value))
    return [partOfALibrary(top, context)];
  if (found === undefined || !/^[A-Z]/.test(name)) return [];
  const { hasMarkup, ...drawn } = rendered(found["body"]);
  if (hasMarkup !== true) return [];
  const parameters = Array.isArray(found["params"]) ? found["params"] : [];
  const written = propsOf(parameters[0], types);
  const isDefault = exported.byDefault === name || (isTop === true && isDefaultStatement === true);
  const hasRange = isNode(value) && typeof value["start"] === "number" && typeof value["end"] === "number";
  return [
    {
      name,
      file,
      line: lineAt(starts, start),
      props: written.length > 0 ? written : propsOfType(typeOfValue(value, annotation), types),
      ...drawn,
      renders: [...new Set(drawn.renders.flatMap((each) => [each, imported.get(each) ?? each]))],
      isExported: isTop === true || exported.named.has(name) || isDefault,
      ...(isDefault ? { isDefault: true } : {}),
      ...guidanceOfComment(commentBefore(text, statement ?? start, documented)),
      ...(hasRange ? codeKey(text.slice(Number(value["start"]), Number(value["end"])), name) : {})
    }
  ];
};

/** The components of a script with JSX. */
const scriptComponents = (file: string, text: string): ScannedComponent[] => {
  if (isTooDeep(text)) return [];
  const { program, errors, comments } = parseSync(file, text);
  if (errors.length > 0) return [];
  const context: ScriptContext = {
    file,
    text,
    types: declaredTypes(program),
    documented: new Map(comments.map((comment) => [comment.end, comment])),
    starts: lineStarts(text),
    exported: exportedNames(program),
    imported: localImports(program)
  };
  return topFunctions(program, file).flatMap((each) => componentOf(each, context));
};

/**
 * A word as a single-file component's file name makes a component name of it.
 *
 * @param file - the file.
 */
export const nameOfFile = (file: string): string =>
  (file.split("/").at(-1) ?? "")
    .replace(/\.[^.]+$/, "")
    .split(/[-_.]/)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join("")
    // a file's name reaches an answer as a component's, and it can hold anything
    .replace(/[^\w$]/g, "");

/**
 * The components a file declares; a file that cannot be parsed declares none, since this reads a project as it is.
 *
 * @param file - its path, relative to the project.
 * @param text - its text.
 */
export const scannedComponents = (file: string, text: string): ScannedComponent[] => {
  try {
    return SINGLE_FILE.test(file) ? [singleFileComponent(file, text)] : scriptComponents(file, text);
  } catch {
    // a stack overflow on a crafted file costs that file
    return [];
  }
};

/**
 * The components of a project's files, leaving out what is no component of its own (stories, tests).
 *
 * @param files - its files.
 */
export const projectComponents = (files: readonly ProjectFile[]): ScannedComponent[] =>
  files.flatMap(({ file, text }) =>
    !LEFT_ALONE.test(file) && COMPONENT_FILE.test(file) ? scannedComponents(file, text) : []
  );
