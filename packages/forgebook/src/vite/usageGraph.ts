/**
 * What each story renders and what each module imports, read from the TypeScript programs the docs already build:
 * the facts "Used in" is joined from (`usageModule.ts`).
 *
 * @remarks
 * Runs in the docs worker (`docsWorker.ts`), which holds the programs; a package's first read builds its program,
 * the API tables reuse it. A story renders the components its JSX names, resolved by the type checker as its types are
 * (a package-name import, an alias, `<Menu.Item>`); a component declared in the story file itself (a scene) is followed
 * into its own JSX; a story without JSX renders its meta's component. A component is known by the file that declares
 * it and its name there, so two imports of one component are one. The import graph holds the modules the rendered
 * components reach through the package's own imports, never a dependency's (`node_modules`): "used through" follows
 * those edges, by what each import names: a name taken through a barrel counts for the file that declares it, or every
 * file a barrel lists would look used (`usageImports.ts`). A lowercase tag is an element (`<div>`), not a component. A component reached only through code the
 * checker cannot follow (a computed lazy import, a component handed in as a prop) is not found.
 *
 * @module
 */
import ts from "typescript-6";

import { configurationOf, programFor } from "./docsProgram.ts";
import { importsOf, textImportsOf } from "./usageImports.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/** A component, by the file that declares it and its name there. */
export type ComponentRef = {
  /** The declaring file's absolute path. */
  readonly file: string;
  /** Its name in that file (`default` for a default export). */
  readonly name: string;
};

/** What one story renders. */
export type StoryRenders = {
  /** The story's export. */
  readonly exportName: string;
  /** The components its JSX names, or its meta's component when it has none; each once. */
  readonly renders: readonly ComponentRef[];
};

/** One story file's facts. */
export type StoryFileUsage = {
  /** The story file's absolute path. */
  readonly storyFile: string;
  /** Its meta's component, when the meta names one the checker resolves. */
  readonly component?: ComponentRef;
  /** Its stories. */
  readonly stories: readonly StoryRenders[];
};

/** What the worker answers for a group of story files. */
export type UsageGraph = {
  /** Each story file's facts, in the order asked; a file no program holds is left out. */
  readonly files: readonly StoryFileUsage[];
  /** Each module the rendered components reach, with the package's own modules it imports. */
  readonly imports: Readonly<Record<string, readonly string[]>>;
};

/** A story file and the exports the index lists as its stories. */
export type UsageRequestFile = {
  /** The story file's absolute path. */
  readonly storyFile: string;
  /** Its stories' exports. */
  readonly exports: readonly string[];
};

/**
 * The symbol a name stands for, through its imports and re-exports.
 *
 * @param symbol - the symbol at the name.
 * @param checker - the program's checker.
 */
const declared = (symbol: ts.Symbol | undefined, checker: ts.TypeChecker): ts.Symbol | undefined =>
  symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0
    ? checker.getAliasedSymbol(symbol)
    : symbol;

/**
 * A component's reference from its symbol: the file of its first declaration, and its name.
 *
 * @param symbol - the component's symbol.
 */
const refOf = (symbol: ts.Symbol | undefined): ComponentRef | undefined => {
  const declaration = symbol?.declarations?.[0];
  if (symbol === undefined || declaration === undefined) return undefined;
  return { file: declaration.getSourceFile().fileName, name: symbol.getName() };
};

/**
 * An expression without the wrappers a meta is written with (`satisfies Meta<…>`, `as Meta`, parentheses).
 *
 * @param expression - the expression.
 */
const unwrap = (expression: ts.Expression): ts.Expression => {
  if (
    ts.isSatisfiesExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isParenthesizedExpression(expression)
  )
    return unwrap(expression.expression);
  return expression;
};

/**
 * The meta's object: the default export, written inline or as a constant.
 *
 * @param source - the story file.
 * @param checker - the program's checker.
 */
const metaObject = (
  source: ts.SourceFile,
  checker: ts.TypeChecker
): ts.ObjectLiteralExpression | undefined => {
  const assignment = source.statements.find(
    (statement): statement is ts.ExportAssignment =>
      ts.isExportAssignment(statement) && !statement.isExportEquals
  );
  if (assignment === undefined) return undefined;
  let value = unwrap(assignment.expression);
  if (ts.isIdentifier(value)) {
    const declaration = declared(checker.getSymbolAtLocation(value), checker)?.valueDeclaration;
    if (
      declaration !== undefined &&
      ts.isVariableDeclaration(declaration) &&
      declaration.initializer !== undefined
    )
      value = unwrap(declaration.initializer);
  }
  return ts.isObjectLiteralExpression(value) ? value : undefined;
};

/**
 * The meta's component, as the checker resolves its `component` property.
 *
 * @param meta - the meta's object.
 * @param checker - the program's checker.
 */
const metaComponent = (
  meta: ts.ObjectLiteralExpression,
  checker: ts.TypeChecker
): ComponentRef | undefined => {
  const property = meta.properties.find(
    (each) => each.name !== undefined && each.name.getText() === "component"
  );
  if (property === undefined) return undefined;
  if (ts.isShorthandPropertyAssignment(property))
    return refOf(declared(checker.getShorthandAssignmentValueSymbol(property), checker));
  if (ts.isPropertyAssignment(property))
    return refOf(declared(checker.getSymbolAtLocation(unwrap(property.initializer)), checker));
  return undefined;
};

/**
 * The symbol a JSX element's tag stands for; none for an element of the page (a lowercase name, `<div>`).
 *
 * @param element - the element's opening or self-closing tag.
 * @param checker - the program's checker.
 */
const tagSymbol = (
  element: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  checker: ts.TypeChecker
): ts.Symbol | undefined => {
  const tag = element.tagName;
  if (ts.isIdentifier(tag) && /^[a-z]/.test(tag.text)) return undefined;
  return declared(checker.getSymbolAtLocation(tag), checker);
};

/**
 * The components a node's JSX names: those declared elsewhere as references, those declared in the story file followed
 * into their own declarations, each declaration once.
 *
 * @param node - the story's node.
 * @param source - the story file.
 * @param checker - the program's checker.
 * @param seen - the declarations already followed.
 */
const jsxRenders = (
  node: ts.Node,
  source: ts.SourceFile,
  checker: ts.TypeChecker,
  seen: Set<ts.Node>
): ComponentRef[] => {
  const found: ComponentRef[] = [];
  const named = (symbol: ts.Symbol | undefined): void => {
    const declaration = symbol?.declarations?.[0];
    const isLocal = declaration !== undefined && declaration.getSourceFile() === source;
    if (!isLocal) {
      const ref = refOf(symbol);
      if (ref !== undefined) found.push(ref);
      return;
    }
    if (seen.has(declaration)) return;
    seen.add(declaration);
    found.push(...jsxRenders(declaration, source, checker, seen));
  };
  const visit = (current: ts.Node): void => {
    if (ts.isJsxOpeningElement(current) || ts.isJsxSelfClosingElement(current))
      named(tagSymbol(current, checker));
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
};

/**
 * References without repeats, in their first order.
 *
 * @param refs - the references.
 */
const unique = (refs: readonly ComponentRef[]): ComponentRef[] => {
  const keys = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.file}#${ref.name}`;
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
};

/**
 * One story file's facts, from the program that holds it.
 *
 * @param request - the story file and its stories' exports.
 * @param program - the program.
 */
const fileUsage = (request: UsageRequestFile, program: ts.Program): StoryFileUsage | undefined => {
  const source = program.getSourceFile(request.storyFile);
  if (source === undefined) return undefined;
  const checker = program.getTypeChecker();
  const meta = metaObject(source, checker);
  const component = meta === undefined ? undefined : metaComponent(meta, checker);
  const moduleSymbol = checker.getSymbolAtLocation(source);
  const exported = moduleSymbol === undefined ? [] : checker.getExportsOfModule(moduleSymbol);
  const stories = request.exports.map((exportName): StoryRenders => {
    const symbol = declared(
      exported.find((each) => each.getName() === exportName),
      checker
    );
    const declaration = symbol?.declarations?.[0];
    const named =
      declaration === undefined ? [] : jsxRenders(declaration, source, checker, new Set([declaration]));
    const renders = named.length === 0 && component !== undefined ? [component] : unique(named);
    return { exportName, renders };
  });
  return { storyFile: request.storyFile, ...(component === undefined ? {} : { component }), stories };
};

/**
 * The import graph of the modules the given files reach, through the package's own imports.
 *
 * @param starts - the files to start from.
 * @param programs - the programs that may hold them.
 */
const reachedImports = (
  starts: readonly string[],
  programs: readonly ts.Program[]
): Record<string, readonly string[]> => {
  const caches = new Map(
    programs.map((program) => [
      program,
      ts.createModuleResolutionCache(
        program.getCurrentDirectory(),
        (name) => name,
        program.getCompilerOptions()
      )
    ])
  );
  const imports: Record<string, readonly string[]> = {};
  const queue = [...starts];
  while (queue.length > 0) {
    const file = queue.pop() ?? "";
    if (file in imports) continue;
    const program = programs.find((candidate) => candidate.getSourceFile(file) !== undefined);
    const source = program?.getSourceFile(file);
    const cache = program === undefined ? undefined : caches.get(program);
    // a style sheet or a single-file component is in no program, and it still imports what it draws with
    const targets =
      program === undefined || source === undefined || cache === undefined
        ? textImportsOf(file, programs[0], programs[0] === undefined ? undefined : caches.get(programs[0]))
        : importsOf(source, program, cache);
    imports[file] = targets;
    queue.push(...targets);
  }
  return imports;
};

/**
 * The facts of the story files one configuration holds, read with the program of what they all reach.
 *
 * @param group - the story files, in Vite's form, each held by the same configuration.
 * @returns the facts, or why a story file's program could not be read.
 */
const groupGraph = (group: readonly UsageRequestFile[]): UsageGraph | string => {
  const files: StoryFileUsage[] = [];
  const programs = new Set<ts.Program>();
  for (const request of group) {
    // what every story of the configuration reaches, in one program built once
    const docsProgram = programFor(request.storyFile, { reach: "stories" });
    if (typeof docsProgram === "string") return docsProgram;
    programs.add(docsProgram.program);
    const usage = fileUsage(request, docsProgram.program);
    if (usage !== undefined) files.push(usage);
  }
  const starts = files.flatMap((file) => [
    // what a story file imports itself runs with its stories: a single-file component, a sheet, a fixture
    file.storyFile,
    ...(file.component === undefined ? [] : [file.component.file]),
    ...file.stories.flatMap((story) => story.renders.map((ref) => ref.file))
  ]);
  return { files, imports: reachedImports([...new Set(starts)], [...programs]) };
};

/**
 * The facts of a group of story files: what each story renders, and the import graph the rendered components reach.
 *
 * @remarks
 * A monorepo has a configuration per package, and holding every package's whole program at once is what stops a
 * worker: the story files a configuration holds are read together, so a configuration's program is let go with the
 * others the docs no longer keep (`KEPT_PROGRAMS`) once its group is read. An import graph is followed inside the
 * program that holds its start, which holds what that start imports.
 *
 * @param requests - the story files and their stories' exports.
 * @returns the facts, or why a story file's program could not be read.
 */
export const usageGraph = (requests: readonly UsageRequestFile[]): UsageGraph | string => {
  const byConfiguration = new Map<string, UsageRequestFile[]>();
  for (const asked of requests) {
    // in Vite's form, as TypeScript names the files the graph is made of, so a story file meets its components
    const request = { ...asked, storyFile: VITE_PATHS.normalize(asked.storyFile) };
    const key = configurationOf(request.storyFile);
    byConfiguration.set(key, [...(byConfiguration.get(key) ?? []), request]);
  }
  const files: StoryFileUsage[] = [];
  const imports: Record<string, readonly string[]> = {};
  for (const group of byConfiguration.values()) {
    const graph = groupGraph(group);
    if (typeof graph === "string") return graph;
    files.push(...graph.files);
    // a file two configurations hold imports, for each, what its options resolve: both are followed
    for (const [file, targets] of Object.entries(graph.imports))
      imports[file] = [...new Set([...(imports[file] ?? []), ...targets])];
  }
  return { files, imports };
};
