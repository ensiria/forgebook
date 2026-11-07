/**
 * The components a package's entries export, by the file that declares each: what "published" means to `verify`.
 *
 * @remarks
 * Read from each file's syntax, with no program: a whole package must take moments on a change that touches one file, and
 * an export's shape says enough. Only relative paths are followed, since a package's own files are what it publishes and
 * another package of the repository has its own entries. A file counts as one finding however many parts it declares
 * (`Dialog`, `DialogTrigger`): one story page shows them together, and a finding per part would bury the one that matters.
 * Only what reads as a component counts. A context, a value, a constant in capitals and a hook are published too, and no
 * story is owed for them.
 *
 * @module
 */
import ts from "typescript-6";

/** A file that is a component by its extension alone: its default export is what it draws. */
const COMPONENT_FILE = /\.(?:vue|svelte|astro)$/;

/** A file whose capitalised functions draw something. */
const DRAWN_FILE = /\.[cm]?[jt]sx$/;

/** A script's text that defines a component with no JSX in it. */
const DEFINES_COMPONENT =
  /\bcustomElements\.define\(|@customElement\(|\bextends\s+(?:LitElement|HTMLElement)\b|@Component\(|\bdefineComponent\(|\bforwardRef\(|\bcreateElement\(|\bstyled[.(]|<\/[A-Za-z][\w.-]{0,80}>|<[A-Z][\w.]{0,80}[^<>\n]{0,500}\/>/;

/** A name a component can have: capitalised and not a constant. */
const COMPONENT_NAME = /^[A-Z](?:[a-z0-9]|[A-Z]+[a-z0-9])\w*$|^[A-Z]$/;

/** A call whose result is no component. */
const NOT_A_COMPONENT_CALL = /^(?:React\.)?(?:createContext|cva|tv|defineConfig|Symbol|Object\.freeze)$/;

/** An import through a project's alias rather than a package's name. */
const ALIASED = /^(?:[@~#]\/|#)/;

/** A published file, with the components it declares. */
export type PublishedFile = {
  /** The file, absolute. */
  readonly file: string;
  /** The names it publishes them under, in the order they are first met. */
  readonly names: readonly string[];
  /** Whether one of them plainly takes props: a parameter, a type argument. */
  readonly takesProps: boolean;
  /** Whether one of them has a doc comment on its declaration, or the file a `@module` one. */
  readonly hasComment: boolean;
};

/** What `publishedComponents` asks of the disk. */
export type ExportsDisk = {
  /** A file's text; none when it does not exist. */
  readonly readText: (file: string) => string | undefined;
  /** The file a relative import names, from the file importing it; none when none is found or it is out of reach. */
  readonly resolve: (specifier: string, from: string) => string | undefined;
  /** Told of an import written through a project's alias, which this cannot follow. */
  readonly onAlias?: (specifier: string, from: string) => void;
};

/** What one export is: where it was declared and how it reads. */
type ExportedThing = {
  /** The declaring file. */
  readonly file: string;
  /** Whether it reads as a component. */
  readonly isComponent: boolean;
  /** Whether it plainly takes props. */
  readonly takesProps: boolean;
  /** Whether its declaration has a doc comment. */
  readonly hasComment: boolean;
};

/** A file's exports by name. */
type FileExports = ReadonlyMap<string, ExportedThing>;

/** How a declaration reads: a function, a class, a wrapped function; undefined when it is no component. */
type DeclarationShape = { readonly takesProps: boolean } | undefined;

/** Whether a call's name says its result is no component. */
const isPlainCall = (call: ts.CallExpression): boolean =>
  NOT_A_COMPONENT_CALL.test(call.expression.getText());

/** How the expression a name is given reads. */
const shapeOfExpression = (node: ts.Expression): DeclarationShape => {
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node))
    return { takesProps: node.parameters.length > 0 };
  if (ts.isClassExpression(node)) return { takesProps: true };
  if (ts.isCallExpression(node)) {
    if (isPlainCall(node)) return undefined;
    const inner = node.arguments.find((each) => ts.isArrowFunction(each) || ts.isFunctionExpression(each));
    const typed = (node.typeArguments?.length ?? 0) > 0;
    return { takesProps: typed || (inner !== undefined && (shapeOfExpression(inner)?.takesProps ?? false)) };
  }
  if (ts.isTaggedTemplateExpression(node)) return { takesProps: false };
  // `export const Tooltip = Primitive.Root`, a library's part under a name of its own
  if (ts.isPropertyAccessExpression(node) && /^[A-Z]/.test(node.name.text)) return { takesProps: false };
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node))
    return shapeOfExpression(node.expression);
  return undefined;
};

/** How a variable's declaration reads: its value, or the type it is written with. */
const shapeOfVariable = (declaration: ts.VariableDeclaration): DeclarationShape => {
  const shape =
    declaration.initializer === undefined ? undefined : shapeOfExpression(declaration.initializer);
  if (shape !== undefined || declaration.type === undefined) return shape;
  return ts.isTypeReferenceNode(declaration.type) && /(?:FC|ComponentType)\b/.test(declaration.type.getText())
    ? { takesProps: (declaration.type.typeArguments?.length ?? 0) > 0 }
    : undefined;
};

/** Whether a statement carries a modifier. */
const hasModifier = (node: ts.HasModifiers, kind: ts.SyntaxKind): boolean =>
  ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) ?? false;

/** What a file declares and what it imports, by local name. */
type FileScope = {
  readonly declared: Map<string, DeclarationShape>;
  /** The names whose declaration has a doc comment. */
  readonly commented: Set<string>;
  readonly imported: Map<string, { readonly from: string; readonly name: string }>;
};

/** The named variables a statement declares. */
const variablesOf = (statement: ts.VariableStatement): readonly ts.VariableDeclaration[] =>
  statement.declarationList.declarations.filter((declaration) => ts.isIdentifier(declaration.name));

/** A variable's name, which `variablesOf` has seen to be an identifier. */
const variableName = (declaration: ts.VariableDeclaration): string => declaration.name.getText();

/** Reads what a statement declares into a file's scope. */
const addDeclared = (statement: ts.Statement, scope: FileScope): void => {
  const isCommented = ts.getJSDocCommentsAndTags(statement).length > 0;
  const declare = (name: string, shape: DeclarationShape): void => {
    scope.declared.set(name, shape);
    if (isCommented) scope.commented.add(name);
  };
  if (ts.isFunctionDeclaration(statement) && statement.name !== undefined)
    declare(statement.name.text, { takesProps: statement.parameters.length > 0 });
  if (ts.isClassDeclaration(statement) && statement.name !== undefined)
    declare(statement.name.text, { takesProps: true });
  if (ts.isVariableStatement(statement))
    for (const declaration of variablesOf(statement))
      declare(variableName(declaration), shapeOfVariable(declaration));
};

/** Reads what a statement imports into a file's scope; a type's import brings no component. */
const addImported = (statement: ts.Statement, scope: FileScope): void => {
  if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) return;
  const from = statement.moduleSpecifier.text;
  const clause = statement.importClause;
  if (clause === undefined || clause.isTypeOnly) return;
  if (clause.name !== undefined) scope.imported.set(clause.name.text, { from, name: "default" });
  if (clause.namedBindings === undefined || !ts.isNamedImports(clause.namedBindings)) return;
  for (const each of clause.namedBindings.elements)
    if (!each.isTypeOnly)
      scope.imported.set(each.name.text, { from, name: (each.propertyName ?? each.name).text });
};

/** How a default export written in place reads. */
const defaultThing = (
  expression: ts.Expression,
  file: string,
  isDrawn: boolean
): ExportedThing | undefined => {
  const shape = shapeOfExpression(expression);
  return shape === undefined
    ? undefined
    : { file, isComponent: isDrawn, takesProps: shape.takesProps, hasComment: false };
};

/** How TypeScript is told to read a file. */
const scriptKindOf = (file: string): ts.ScriptKind => {
  if (/\.tsx$/.test(file)) return ts.ScriptKind.TSX;
  if (/\.jsx$/.test(file)) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/.test(file)) return ts.ScriptKind.JSX;
  return ts.ScriptKind.TS;
};

/** Reads what a file's statements export, following its imports through `followed`. */
type ExportContext = {
  /** The file. */
  readonly file: string;
  /** Whether it draws: a capitalised function in a file of plain logic is no component. */
  readonly isDrawn: boolean;
  /** What it has found so far. */
  readonly found: Map<string, ExportedThing>;
  /** What a name in the file's scope is. */
  readonly local: (name: string) => ExportedThing | undefined;
  /** What another file exports under a name, by a relative import. */
  readonly followed: (specifier: string, name: string) => ExportedThing | undefined;
  /** Everything another file exports, by a relative import. */
  readonly allOf: (specifier: string) => FileExports;
};

/** Records an export, when it is something this can tell of. */
const record = (context: ExportContext, name: string, thing: ExportedThing | undefined): void => {
  if (thing !== undefined) context.found.set(name, thing);
};

/** Adds what `export { … }`, with or without a `from`, exports. */
const addNamedExports = (
  clause: ts.NamedExports,
  specifier: string | undefined,
  context: ExportContext
): void => {
  for (const each of clause.elements) {
    if (each.isTypeOnly) continue;
    const name = (each.propertyName ?? each.name).text;
    const thing = specifier === undefined ? context.local(name) : context.followed(specifier, name);
    record(context, each.name.text, thing);
  }
};

/** Adds what an `export … from`, or `export { … }`, exports. */
const addExportDeclaration = (statement: ts.ExportDeclaration, context: ExportContext): void => {
  if (statement.isTypeOnly) return;
  const { moduleSpecifier, exportClause } = statement;
  const specifier =
    moduleSpecifier !== undefined && ts.isStringLiteral(moduleSpecifier) ? moduleSpecifier.text : undefined;
  if (exportClause !== undefined && ts.isNamedExports(exportClause)) {
    addNamedExports(exportClause, specifier, context);
    return;
  }
  if (specifier === undefined) return;
  // `export * as Dialog from`, or `export *`: either way what that file exports is published under its own name
  for (const [name, thing] of context.allOf(specifier)) {
    if (name !== "default" && !context.found.has(name)) context.found.set(name, thing);
  }
};

/** Adds what `export default <expression>` exports. */
const addExportAssignment = (statement: ts.ExportAssignment, context: ExportContext): void => {
  const { expression } = statement;
  const thing = ts.isIdentifier(expression)
    ? context.local(expression.text)
    : defaultThing(expression, context.file, context.isDrawn);
  record(context, "default", thing);
};

/** Adds what `export function` or `export class`, with a name or as the default, exports. */
const addExportedDeclaration = (
  statement: ts.FunctionDeclaration | ts.ClassDeclaration,
  context: ExportContext
): void => {
  const name = statement.name?.text;
  const thing =
    name === undefined
      ? {
          file: context.file,
          isComponent: context.isDrawn,
          takesProps: ts.isClassDeclaration(statement),
          hasComment: ts.getJSDocCommentsAndTags(statement).length > 0
        }
      : context.local(name);
  const isDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword);
  record(context, isDefault ? "default" : (name ?? "default"), thing);
};

/** Adds what one statement exports. */
const addExports = (statement: ts.Statement, context: ExportContext): void => {
  if (ts.isExportDeclaration(statement)) {
    addExportDeclaration(statement, context);
    return;
  }
  if (ts.isExportAssignment(statement)) {
    if (!statement.isExportEquals) addExportAssignment(statement, context);
    return;
  }
  if (!ts.canHaveModifiers(statement) || !hasModifier(statement, ts.SyntaxKind.ExportKeyword)) return;
  if (ts.isVariableStatement(statement)) {
    for (const declaration of variablesOf(statement)) {
      const name = variableName(declaration);
      record(context, name, context.local(name));
    }
    return;
  }
  if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement))
    addExportedDeclaration(statement, context);
};

/**
 * Reads files' exports, each file once.
 *
 * @param disk - what is asked of the disk.
 * @returns what reads one file; a file reached again while it is read (a cycle) has none yet, as a cycle adds nothing.
 */
const exportReader = (disk: ExportsDisk): ((file: string) => FileExports) => {
  const seen = new Map<string, FileExports>();
  const targetOf = (specifier: string, from: string): string | undefined => {
    if (ALIASED.test(specifier)) disk.onAlias?.(specifier, from);
    return specifier.startsWith(".") ? disk.resolve(specifier, from) : undefined;
  };
  const exportsOf = (file: string): FileExports => {
    const known = seen.get(file);
    if (known !== undefined) return known;
    const found = new Map<string, ExportedThing>();
    seen.set(file, found);
    const text = disk.readText(file);
    if (text === undefined) return found;
    if (COMPONENT_FILE.test(file)) {
      found.set("default", { file, isComponent: true, takesProps: false, hasComment: false });
      return found;
    }
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKindOf(file));
    const isDrawn = DRAWN_FILE.test(file) || DEFINES_COMPONENT.test(text);
    const scope: FileScope = { declared: new Map(), commented: new Set(), imported: new Map() };
    for (const statement of source.statements) {
      addDeclared(statement, scope);
      addImported(statement, scope);
    }
    const followed = (specifier: string, name: string): ExportedThing | undefined => {
      const target = targetOf(specifier, file);
      return target === undefined ? undefined : exportsOf(target).get(name);
    };
    // once per file: the text may be large, and every export of it asks
    const hasModuleComment = text.includes("@module");
    const context: ExportContext = {
      file,
      isDrawn,
      found,
      followed,
      allOf: (specifier: string): FileExports => {
        const target = targetOf(specifier, file);
        return target === undefined ? new Map() : exportsOf(target);
      },
      local: (name: string): ExportedThing | undefined => {
        const imported = scope.imported.get(name);
        if (imported !== undefined) return followed(imported.from, imported.name);
        if (!scope.declared.has(name)) return undefined;
        const shape = scope.declared.get(name);
        return {
          file,
          isComponent: isDrawn && shape !== undefined,
          takesProps: shape?.takesProps ?? false,
          hasComment: scope.commented.has(name) || hasModuleComment
        };
      }
    };
    for (const statement of source.statements) addExports(statement, context);
    return found;
  };
  return exportsOf;
};

/** The name a file goes by: its own, or its folder's for an index. */
const stemOf = (file: string): string => {
  const parts = file.split("/");
  const name = (parts.at(-1) ?? "").replace(/\.[^.]+$/, "");
  return name === "index" ? (parts.at(-2) ?? name) : name;
};

/** The name a published thing goes by, when it reads as a component: a default export by its file's. */
const componentNameOf = (name: string, thing: ExportedThing): string | undefined => {
  if (!thing.isComponent) return undefined;
  const stem = stemOf(thing.file);
  const named = name === "default" ? `${stem.charAt(0).toUpperCase()}${stem.slice(1)}` : name;
  return COMPONENT_NAME.test(named) && !named.endsWith("Context") ? named : undefined;
};

/**
 * The components some entries publish, one element per declaring file.
 *
 * @param entries - the entries' source files, absolute.
 * @param disk - what is asked of the disk.
 */
export const publishedComponents = (entries: readonly string[], disk: ExportsDisk): PublishedFile[] => {
  const exportsOf = exportReader(disk);
  const files = new Map<string, { names: string[]; takesProps: boolean; hasComment: boolean }>();
  const things = entries.flatMap((entry) => [...exportsOf(entry)]);
  for (const [name, thing] of things) {
    const named = componentNameOf(name, thing);
    if (named === undefined) continue;
    const file = files.get(thing.file) ?? { names: [], takesProps: false, hasComment: false };
    if (!file.names.includes(named)) file.names.push(named);
    file.takesProps ||= thing.takesProps;
    file.hasComment ||= thing.hasComment;
    files.set(thing.file, file);
  }
  return [...files].map(([file, each]) => ({ file, ...each }));
};
