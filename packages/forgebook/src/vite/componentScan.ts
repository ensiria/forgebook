/**
 * The components a project's files declare, read from their text: their names, what they render at their root, the props
 * they take and the classes they carry.
 *
 * @remarks
 * Pure, and read without a type checker: this has to work on a project with no catalogue, in a moment, over every file.
 *
 * @module
 */
import { type ESTree, parseSync } from "vite";

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
};

/** A framework's own single-file component. */
const SINGLE_FILE = /\.(?:vue|svelte|astro)$/;

/** What opens or closes a level of a script. */
const NESTING = /<\/|\/>|<[A-Za-z]|[([{)\]}]/g;

/** How deep a script may nest before it is left out. */
const MOST_NESTED = 400;

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

/** Where each line of a text starts, to find a line by offset without reading from the start each time. */
const lineStarts = (text: string): readonly number[] => {
  const starts = [0];
  for (let at = text.indexOf("\n"); at !== -1; at = text.indexOf("\n", at + 1)) starts.push(at + 1);
  return starts;
};

/** The line of an offset, from 1. */
const lineAt = (starts: readonly number[], offset: number): number => {
  let [low, high] = [0, starts.length - 1];
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((starts[middle] ?? 0) <= offset) low = middle;
    else high = middle - 1;
  }
  return low + 1;
};

/**
 * Whether a text nests past what a parser and a walk over its tree can take: a crafted file must cost that file, and past
 * this depth the parser itself overflows, which no `catch` can answer.
 *
 * @param text - a script.
 */
export const isTooDeep = (text: string): boolean => {
  let depth = 0;
  for (const match of text.matchAll(NESTING)) {
    const [token = ""] = match;
    depth +=
      token.startsWith("</") || token === ")" || token === "]" || token === "}" || token === "/>" ? -1 : 1;
    if (depth > MOST_NESTED) return true;
  }
  return false;
};

/** A function at a program's top, with what is known of it from outside. */
type TopFunction = {
  readonly name: string;
  readonly value: unknown;
  readonly start: number;
  /** A declaration's type (`React.FC<Props>`). */
  readonly annotation?: unknown;
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
      : topFunctionsOf(declaration, file, statement.type === "ExportDefaultDeclaration");
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

/** The components of a script with JSX. */
const scriptComponents = (file: string, text: string): ScannedComponent[] => {
  if (isTooDeep(text)) return [];
  const { program, errors } = parseSync(file, text);
  if (errors.length > 0) return [];
  const types = declaredTypes(program);
  const starts = lineStarts(text);
  return topFunctions(program, file).flatMap(({ name, value, start, annotation }): ScannedComponent[] => {
    const found = functionOf(value);
    if (found === undefined || !/^[A-Z]/.test(name)) return [];
    const { hasMarkup, ...drawn } = rendered(found["body"]);
    if (hasMarkup !== true) return [];
    const parameters = Array.isArray(found["params"]) ? found["params"] : [];
    const written = propsOf(parameters[0], types);
    const props = written.length > 0 ? written : propsOfType(typeOfValue(value, annotation), types);
    return [{ name, file, line: lineAt(starts, start), props, ...drawn }];
  });
};

/** A word as a single-file component's file name makes a component name of it. */
const nameOfFile = (file: string): string =>
  (file.split("/").at(-1) ?? "")
    .replace(/\.[^.]+$/, "")
    .split(/[-_.]/)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join("");

/** A text without what stands between each pair of markers. */
const without = (text: string, open: string, close: string): string => {
  let out = "";
  let index = 0;
  for (let start = text.indexOf(open); start !== -1; start = text.indexOf(open, index)) {
    const end = text.indexOf(close, start);
    if (end === -1) break;
    out += text.slice(index, start);
    index = end + close.length;
  }
  return out + text.slice(index);
};

/** The markup of a single-file component: its template's, or what is left without scripts and styles. */
const markupOf = (text: string): string => {
  const [open, close] = [text.indexOf("<template"), text.lastIndexOf("</template>")];
  const opened = open === -1 ? -1 : text.indexOf(">", open);
  if (opened !== -1 && close > opened) return text.slice(opened + 1, close);
  const plain = without(without(text, "<script", "</script>"), "<style", "</style>");
  return plain.startsWith("---") ? plain.slice(plain.indexOf("---", 3) + 3) : plain;
};

/** The one component of a `.vue`, `.svelte` or `.astro` file, from its text. */
const singleFileComponent = (file: string, text: string): ScannedComponent => {
  const markup = markupOf(text);
  const first = /<([a-zA-Z][\w.-]{0,80})([^<>]{0,2000})>/.exec(markup);
  const classes = /(?<![:\w-])class="([^"]*)"/.exec(first?.[2] ?? "")?.[1] ?? "";
  const defined = /defineProps<\{([^}]{0,5000})\}>/.exec(text)?.[1] ?? "";
  const props = [
    ...[...defined.matchAll(/(\w+)\??\s*:/g)].flatMap((match) => match[1] ?? []),
    ...[...text.matchAll(/export let (\w+)/g)].flatMap((match) => match[1] ?? [])
  ];
  const renders = [...markup.matchAll(/<([A-Z][\w.]*)/g)].flatMap((match) => match[1] ?? []);
  return {
    name: nameOfFile(file),
    file,
    line: 1,
    ...(first?.[1] === undefined ? {} : { root: first[1] }),
    props,
    classes: classes.split(/\s+/).filter((each) => each !== ""),
    renders: [...new Set(renders)]
  };
};

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
