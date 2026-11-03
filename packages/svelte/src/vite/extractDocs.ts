/**
 * The component of a Svelte story file, read from its types and comments: its props, snippets and callback props. The
 * docs module of `@forgebook/svelte`: the plugin's worker and `forgebook-docs` load it through the adapter
 * (`forgebook/vite/adapter`).
 *
 * @remarks
 * The component is the meta's `component`, found by the type checker, so an import through an alias, a package or a
 * barrel leads to its file. The checker reads a `.svelte` file as the TypeScript `svelte2tsx` writes for it
 * (`svelteSources.ts`), in the core's programs, so what it takes is read as any component's (`componentProps.ts`). A
 * component describes itself as Svelte's language server reads it, in its `<!-- @component -->` comment, tags included
 * (`@useWhen`, `@deprecated`); the comment that opens its script, with `@module`, is the summary.
 *
 * @module
 */
import { basename, extname } from "node:path";

import type { ComponentDocs, NoComponentDocs, SubcomponentDocs } from "forgebook/component-docs";
import type { StoryComponentResult, StoryFileShape } from "forgebook/vite/adapter";
import {
  chosenExport,
  type DocsProgram,
  moduleSummaryOf,
  programFor,
  summaryOf
} from "forgebook/vite/docs-program";
import { declaredSymbol } from "forgebook/vite/prop-docs";
import { signatureDocs } from "forgebook/vite/signature-docs";
import { metaComponent, metaSubcomponents } from "forgebook/vite/story-meta";
import { guidanceOf } from "forgebook/vite/usage-guidance";
import ts from "typescript-6";

import { componentProps, sourceFileOf } from "./componentProps.ts";
import { scriptOf } from "./svelteScript.ts";
import { COMPONENT_EXTENSION, componentScriptFile, SVELTE_SOURCES } from "./svelteSources.ts";

/** The module a Svelte story file imports its types from (`Meta`, `Story`), for the stories `forgebook new` writes. */
export const storyTypesModule = "@forgebook/svelte";

/** A story file's or a component's program, with its components read as TypeScript. */
const svelteProgram = (file: string): DocsProgram | string => programFor(file, SVELTE_SOURCES);

/**
 * The file that declares a symbol, a component as its `.svelte` file.
 *
 * @param symbol - the declared symbol.
 * @param fallback - the file when it has no declaration.
 */
const fileOf = (symbol: ts.Symbol, fallback: string): string =>
  sourceFileOf(symbol.declarations?.[0]?.getSourceFile().fileName ?? fallback);

/**
 * What a component says of itself: its `@component` comment, its tags, and its script's `@module` comment.
 *
 * @param symbol - its declared symbol.
 * @param file - its file.
 * @param program - the program.
 */
const componentProse = (
  symbol: ts.Symbol,
  file: string,
  program: DocsProgram
): Pick<ComponentDocs, "description" | "summary" | "guidance"> => {
  const isComponentFile = extname(file) === COMPONENT_EXTENSION;
  const source = isComponentFile
    ? ts.createSourceFile(file, scriptOf(ts.sys.readFile(file) ?? ""), ts.ScriptTarget.Latest, true)
    : program.program.getSourceFile(file);
  return {
    description: summaryOf(symbol, program.checker),
    summary: source === undefined ? "" : moduleSummaryOf(source),
    ...guidanceOf(symbol, program.checker)
  };
};

/**
 * A component's docs and the files they come from.
 *
 * @param name - its name.
 * @param symbol - its declared symbol.
 * @param node - where the code names it.
 * @param program - the program.
 * @param subcomponents - the subcomponents' docs and files; none outside a story file.
 */
const componentOf = (
  name: string,
  symbol: ts.Symbol,
  node: ts.Node,
  program: DocsProgram,
  subcomponents: { readonly docs: SubcomponentDocs[]; readonly sources: string[] }
): StoryComponentResult => {
  const file = fileOf(symbol, node.getSourceFile().fileName);
  const read = componentProps(symbol, program.checker, node, file);
  return {
    docs: {
      name,
      ...componentProse(symbol, file, program),
      props: read.props,
      parts: read.parts,
      subcomponents: subcomponents.docs
    },
    file,
    sources: [...new Set([...read.sources, ...subcomponents.sources])]
  };
};

/**
 * Whether a symbol stands for a function rather than a component: a name in camelCase that can be called, declared
 * outside a component's file. A Svelte component is a function too, so its name and its file tell.
 */
const isLogic = (symbol: ts.Symbol, checker: ts.TypeChecker, node: ts.Node): boolean =>
  /^[a-z]/.test(symbol.getName()) &&
  symbol.getName() !== "default" &&
  extname(fileOf(symbol, "")) !== COMPONENT_EXTENSION &&
  checker.getTypeOfSymbolAtLocation(symbol, node).getCallSignatures().length > 0;

/**
 * A function's docs: its signature, which a story about logic shows first.
 *
 * @param symbol - the function's symbol.
 * @param expression - where the code names it.
 * @param program - the program.
 */
const logicOf = (
  symbol: ts.Symbol,
  expression: ts.Expression,
  program: DocsProgram
): StoryComponentResult => {
  const file = fileOf(symbol, expression.getSourceFile().fileName);
  const signature = signatureDocs(symbol, expression, program.checker);
  return {
    docs: {
      name: symbol.getName(),
      ...componentProse(symbol, file, program),
      props: [],
      parts: [],
      subcomponents: [],
      ...(signature === undefined ? {} : { signature })
    },
    file,
    sources: [file]
  };
};

/**
 * The docs of the subcomponents a story file's meta names, with the files they come from.
 *
 * @param source - the story file, parsed.
 * @param program - its program.
 * @returns the docs and their files, or a message naming the subcomponent that cannot be resolved.
 */
const subcomponentsOf = (
  source: ts.SourceFile,
  program: DocsProgram
): { readonly docs: SubcomponentDocs[]; readonly sources: string[] } | string => {
  const docs: SubcomponentDocs[] = [];
  const sources: string[] = [];
  for (const subcomponent of metaSubcomponents(source, program.checker)) {
    const symbol = declaredSymbol(subcomponent.symbol, program.checker);
    if (symbol === undefined) {
      return `${source.fileName}: the meta's subcomponent ${subcomponent.name} cannot be resolved`;
    }
    const file = fileOf(symbol, source.fileName);
    const read = componentProps(symbol, program.checker, subcomponent.expression, file);
    docs.push({
      name: subcomponent.name,
      description: componentProse(symbol, file, program).description,
      props: read.props
    });
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
  const program = svelteProgram(storyFile);
  if (typeof program === "string") return program;
  const source = program.program.getSourceFile(storyFile);
  if (source === undefined) return `${storyFile} is not in its program`;
  const expression = metaComponent(source);
  if (expression === undefined) return { docs: { name: null } };
  const symbol = declaredSymbol(program.checker.getSymbolAtLocation(expression), program.checker);
  if (symbol === undefined) return `${storyFile}: the meta's component cannot be resolved`;
  if (isLogic(symbol, program.checker, expression)) return logicOf(symbol, expression, program);
  const subcomponents = subcomponentsOf(source, program);
  if (typeof subcomponents === "string") return subcomponents;
  return componentOf(expression.getText(source), symbol, expression, program, subcomponents);
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

/** A file's name as a component's (`my-button` → `MyButton`). */
const pascalCase = (name: string): string =>
  name
    .split(/[^A-Za-z0-9]+/)
    .filter((part) => part !== "")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");

/** Reads a component of a file; `extractFileComponent` says what can go wrong. */
const readFileComponent = (file: string, exportName: string | undefined): StoryComponentResult => {
  const isComponentFile = extname(file) === COMPONENT_EXTENSION;
  // a component is read through the TypeScript written for it
  const read = isComponentFile ? componentScriptFile(file) : file;
  const program = svelteProgram(read);
  if (typeof program === "string") return program;
  const source = program.program.getSourceFile(read);
  if (source === undefined) return `${file} cannot be read as a component`;
  const module = program.checker.getSymbolAtLocation(source);
  if (module === undefined) return `${file} exports nothing`;
  const exported = program.checker.getExportsOfModule(module);
  const components = exported
    .filter((each) => ((declaredSymbol(each, program.checker) ?? each).flags & ts.SymbolFlags.Value) !== 0)
    .map((each) => each.getName())
    .filter((name) => (isComponentFile ? name === "default" : /^[A-Z]/.test(name)));
  const chosen = chosenExport(components, isComponentFile ? "default" : exportName, file);
  if (typeof chosen !== "string") return chosen.problem;
  const symbol = exported.find((each) => each.getName() === chosen);
  if (symbol === undefined) return `${file} exports no component ${chosen}`;
  const name = isComponentFile ? pascalCase(basename(file, COMPONENT_EXTENSION)) : chosen;
  return componentOf(name, declaredSymbol(symbol, program.checker) ?? symbol, source, program, {
    docs: [],
    sources: []
  });
};

/**
 * A component a file exports, for writing its first stories (`forgebook new`): a `.svelte` file is its default export,
 * named after its file.
 *
 * @param file - the component's file, absolute.
 * @param exportName - the export to read; the file's only component when none.
 * @returns the component, or a message saying why it cannot be read (no component, several, a name not exported).
 */
export const extractFileComponent = (file: string, exportName?: string): StoryComponentResult =>
  orMessage(file, () => readFileComponent(file, exportName));

/**
 * How `forgebook new` writes a Svelte component's stories: `.ts`, since a story needs no markup, a `.svelte` file
 * imported by its default export and with its extension.
 *
 * @param name - the component's name.
 * @param file - the component's file, absolute.
 */
export const storyFileShape = (name: string, file: string): StoryFileShape => ({
  extension: ".stories.ts",
  importStatement:
    extname(file) === COMPONENT_EXTENSION
      ? `import ${name} from ${JSON.stringify(`./${basename(file)}`)};`
      : `import { ${name} } from ${JSON.stringify(`./${basename(file).replace(/\.[cm]?[jt]s$/, "")}`)};`
});
