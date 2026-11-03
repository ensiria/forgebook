/**
 * The component of an Angular story file, read from its types, its decorator and its TSDoc: its selector, its inputs,
 * outputs and projected content. The docs module of `@forgebook/angular`: the plugin's worker and `forgebook-docs` load
 * it through the adapter (`forgebook/vite/adapter`).
 *
 * @remarks
 * The component is the meta's `component`, found by the type checker in the core's TypeScript program
 * (`forgebook/vite/docs-program`), so an import through an alias, a path mapping or a barrel leads to its class. Its
 * members are read from the class and its decorator (`angularMembers.ts`), never by running them, so the docs follow
 * an edit without a build. Compodoc, which Storybook's Angular stories read, is not used: it is a separate command whose
 * JSON goes stale between runs, while the program is already kept up to date for every framework.
 *
 * @module
 */
import { basename } from "node:path";

import type { ComponentDocs, NoComponentDocs, SubcomponentDocs } from "forgebook/component-docs";
import type { StoryComponentResult, StoryFileShape } from "forgebook/vite/adapter";
import { chosenExport, programFor, summaryOf } from "forgebook/vite/docs-program";
import { moduleSummaryOf } from "forgebook/vite/module-summary";
import { declaredSymbol } from "forgebook/vite/prop-docs";
import { signatureDocs } from "forgebook/vite/signature-docs";
import { metaComponent, metaSubcomponents } from "forgebook/vite/story-meta";
import { guidanceOf } from "forgebook/vite/usage-guidance";
import ts from "typescript-6";

import { classProps } from "./angularMembers.ts";
import { CLASS_DECORATORS, classMetadata, decoratorsOf, propertyOf, textOf } from "./classDecorators.ts";

/** The module an Angular story file imports its types from (`Meta`, `Story`), for the stories `forgebook new` writes. */
export const storyTypesModule = "@forgebook/angular";

/**
 * The class a symbol declares, when it declares one.
 *
 * @param symbol - the declared symbol.
 */
const classOf = (symbol: ts.Symbol): ts.ClassDeclaration | undefined =>
  symbol.declarations?.find(ts.isClassDeclaration);

/** Whether a class is a component or a directive: Angular draws or applies it. */
const isAngularClass = (node: ts.ClassDeclaration): boolean =>
  decoratorsOf(node).some((decorator) => CLASS_DECORATORS.includes(decorator.name));

/** Whether a symbol stands for a function rather than a class: a name in camelCase that can be called. */
const isLogic = (symbol: ts.Symbol, checker: ts.TypeChecker, node: ts.Node): boolean =>
  /^[a-z]/.test(symbol.getName()) &&
  checker.getTypeOfSymbolAtLocation(symbol, node).getCallSignatures().length > 0;

/**
 * A component's docs and the files they come from.
 *
 * @param symbol - its declared symbol.
 * @param checker - the program's checker.
 * @param file - the file read, when it has no declaration.
 * @param subcomponents - the subcomponents' docs and files; none outside a story file.
 */
const componentOf = (
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
  file: string,
  subcomponents: { readonly docs: SubcomponentDocs[]; readonly sources: string[] }
): StoryComponentResult => {
  const node = classOf(symbol);
  const source = node?.getSourceFile() ?? symbol.declarations?.[0]?.getSourceFile();
  const read = node === undefined || !isAngularClass(node) ? undefined : classProps(node, checker);
  const selector = node === undefined ? undefined : textOf(propertyOf(classMetadata(node), "selector"));
  const docs: ComponentDocs = {
    name: symbol.getName(),
    description: summaryOf(symbol, checker),
    summary: source === undefined ? "" : moduleSummaryOf(source.text),
    props: read?.props ?? [],
    parts: [],
    subcomponents: subcomponents.docs,
    ...guidanceOf(symbol, checker),
    ...(selector === undefined ? {} : { selector })
  };
  const declared = source?.fileName ?? file;
  return {
    docs,
    file: declared,
    sources: [...new Set([declared, ...(read?.sources ?? []), ...subcomponents.sources])]
  };
};

/**
 * A function's docs: its signature, which a story about logic shows first.
 *
 * @param symbol - the function's symbol.
 * @param expression - where the code names it.
 * @param checker - the program's checker.
 * @param file - the file read, when it has no declaration.
 */
const logicOf = (
  symbol: ts.Symbol,
  expression: ts.Expression,
  checker: ts.TypeChecker,
  file: string
): StoryComponentResult => {
  const source = symbol.declarations?.[0]?.getSourceFile();
  const signature = signatureDocs(symbol, expression, checker);
  const declared = source?.fileName ?? file;
  return {
    docs: {
      name: symbol.getName(),
      description: summaryOf(symbol, checker),
      summary: source === undefined ? "" : moduleSummaryOf(source.text),
      props: [],
      parts: [],
      subcomponents: [],
      ...guidanceOf(symbol, checker),
      ...(signature === undefined ? {} : { signature })
    },
    file: declared,
    sources: [declared]
  };
};

/**
 * The docs of the subcomponents a story file's meta names, with the files they come from.
 *
 * @param source - the story file, parsed.
 * @param checker - the program's checker.
 * @returns the docs and their files, or a message naming the subcomponent that cannot be resolved.
 */
const subcomponentsOf = (
  source: ts.SourceFile,
  checker: ts.TypeChecker
): { readonly docs: SubcomponentDocs[]; readonly sources: string[] } | string => {
  const docs: SubcomponentDocs[] = [];
  const sources: string[] = [];
  for (const subcomponent of metaSubcomponents(source, checker)) {
    const symbol = declaredSymbol(subcomponent.symbol, checker);
    const node = symbol === undefined ? undefined : classOf(symbol);
    if (symbol === undefined || node === undefined)
      return `${source.fileName}: the meta's subcomponent ${subcomponent.name} cannot be resolved`;
    const read = classProps(node, checker);
    docs.push({ name: subcomponent.name, description: summaryOf(symbol, checker), props: read.props });
    sources.push(...read.sources);
  }
  return { docs, sources };
};

/**
 * What a read gave, or why it threw as a message: one file the checker cannot read must not end `forgebook docs` for a
 * whole package.
 *
 * @param file - the file read, for the message.
 * @param read - the read.
 */
const orMessage = (file: string, read: () => StoryComponentResult): StoryComponentResult => {
  try {
    return read();
  } catch (error) {
    return `${file}: ${error instanceof Error ? error.message : String(error)}`;
  }
};

/** Reads a story file's component; `extractStoryComponent` says what can go wrong. */
const readStoryComponent = (storyFile: string): StoryComponentResult => {
  const program = programFor(storyFile);
  if (typeof program === "string") return program;
  const { checker } = program;
  const source = program.program.getSourceFile(storyFile);
  if (source === undefined) return `${storyFile} is not in its program`;
  const expression = metaComponent(source);
  if (expression === undefined) return { docs: { name: null } };
  const symbol = declaredSymbol(checker.getSymbolAtLocation(expression), checker);
  if (symbol === undefined) return `${storyFile}: the meta's component cannot be resolved`;
  if (isLogic(symbol, checker, expression)) return logicOf(symbol, expression, checker, storyFile);
  const subcomponents = subcomponentsOf(source, checker);
  if (typeof subcomponents === "string") return subcomponents;
  return componentOf(symbol, checker, storyFile, subcomponents);
};

/**
 * A story file's component with the file that declares it.
 *
 * @param storyFile - the story file's absolute path.
 * @returns the component, `{ docs: { name: null } }` when the meta names none, or a message saying why the file
 * cannot be read.
 */
export const extractStoryComponent = (storyFile: string): StoryComponentResult =>
  orMessage(storyFile, () => readStoryComponent(storyFile));

/**
 * The docs of a story file's component.
 *
 * @param storyFile - the story file's absolute path.
 * @returns the component's docs, `{ name: null }` when the meta names no component, or a message saying why the file
 * cannot be read.
 */
export const extractComponentDocs = (storyFile: string): ComponentDocs | NoComponentDocs | string => {
  const component = extractStoryComponent(storyFile);
  return typeof component === "string" ? component : component.docs;
};

/** Reads a component of a file; `extractFileComponent` says what can go wrong. */
const readFileComponent = (file: string, exportName: string | undefined): StoryComponentResult => {
  const program = programFor(file);
  if (typeof program === "string") return program;
  const { checker } = program;
  const source = program.program.getSourceFile(file);
  if (source === undefined) return `${file} is not in its program`;
  const module = checker.getSymbolAtLocation(source);
  if (module === undefined) return `${file} exports nothing`;
  const components = checker.getExportsOfModule(module).filter((each) => {
    const node = classOf(declaredSymbol(each, checker) ?? each);
    return node !== undefined && isAngularClass(node);
  });
  const chosen = chosenExport(
    components.map((each) => each.getName()),
    exportName,
    file
  );
  if (typeof chosen !== "string") return chosen.problem;
  const symbol = components.find((each) => each.getName() === chosen);
  if (symbol === undefined) return `${file} exports no component ${chosen}`;
  return componentOf(declaredSymbol(symbol, checker) ?? symbol, checker, file, { docs: [], sources: [] });
};

/**
 * A component or a directive a file exports, read from its class, for writing its first stories (`forgebook new`).
 *
 * @param file - the component's file, absolute.
 * @param exportName - the export to read; the file's only component or directive when none.
 * @returns the component, or a message saying why it cannot be read (none, several, a name not exported).
 */
export const extractFileComponent = (file: string, exportName?: string): StoryComponentResult =>
  orMessage(file, () => readFileComponent(file, exportName));

/**
 * How `forgebook new` writes an Angular component's stories: `.ts`, since a story needs no JSX, the class imported by
 * its name from its file (`badge.component.ts` or `badge.ts`).
 *
 * @param name - the component's name.
 * @param file - the component's file, absolute.
 */
export const storyFileShape = (name: string, file: string): StoryFileShape => ({
  extension: ".stories.ts",
  importStatement: `import { ${name} } from ${JSON.stringify(`./${basename(file).replace(/\.[cm]?ts$/, "")}`)};`
});
