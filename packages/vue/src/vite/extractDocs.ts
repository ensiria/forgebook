/**
 * The component of a Vue story file, read from its types and TSDoc: its props, events and slots. The docs module of
 * `@forgebook/vue`: the plugin's worker and `forgebook-docs` load it through the adapter (`forgebook/vite/adapter`).
 *
 * @remarks
 * The component is the meta's `component`, found by the type checker, so an import through an alias, a package or a
 * barrel leads to its file. `vue-component-meta` says what it takes, single-file components included, through a language
 * service that sees a `.vue` file as the TypeScript it amounts to. Its props read as a React component's do
 * (`forgebook/vite/prop-docs`), from the checker's symbols, with the default `withDefaults` writes; what it passes on
 * to the DOM comes from `node_modules` and is left out. A `.vue` file has no declaration to hold a TSDoc comment, so
 * the comment that opens its script speaks for the component.
 *
 * @module
 */
import { basename, dirname, extname, join } from "node:path";

import type { ComponentDocs, NoComponentDocs, PropDocs, SubcomponentDocs } from "forgebook/component-docs";
import type { StoryComponentResult, StoryFileShape } from "forgebook/vite/adapter";
import { chosenExport, moduleSummaryOf, summaryOf } from "forgebook/vite/docs-program";
import { declarationOrder, declaredSymbol, isForeign, partsOf, propDocs } from "forgebook/vite/prop-docs";
import { signatureDocs } from "forgebook/vite/signature-docs";
import { metaComponent, metaSubcomponents } from "forgebook/vite/story-meta";
import { guidanceOf, guidanceOfTags } from "forgebook/vite/usage-guidance";
import ts from "typescript-6";
import type { PropertyMeta } from "vue-component-meta";
import { getExport } from "vue-component-meta/lib/checker.js";
import { inferComponentProps } from "vue-component-meta/lib/helpers.js";

import { type ComponentChecker, checkerFor, markCheckersChanged } from "./componentChecker.ts";
import { eventDocs, slotDocs } from "./eventDocs.ts";
import { emitComments, scriptComment } from "./sfcComment.ts";
import { scriptOf, scriptsOf } from "./sfcScript.ts";

/** The module a Vue story file imports its types from (`Meta`, `Story`), for the stories `forgebook new` writes. */
export const storyTypesModule = "@forgebook/vue";

/** The worker heard that a source changed: the checkers read again on their next read. */
export const sourcesChanged: () => void = markCheckersChanged;

/** A single-file component's extension. */
const SFC = ".vue";

/** Where a component is: its file and the export that holds it. */
type ComponentPlace = {
  /** The file that declares it. */
  readonly file: string;
  /** The export (`default` for a single-file component). */
  readonly exportName: string;
};

/**
 * One prop of a component.
 *
 * @param symbol - the prop.
 * @param meta - what `vue-component-meta` read of it: the default `withDefaults` writes, whether it is required.
 * @param checker - the program's checker.
 * @param node - where the code names the component.
 */
const vuePropDocs = (
  symbol: ts.Symbol,
  meta: PropertyMeta | undefined,
  checker: ts.TypeChecker,
  node: ts.Node
): PropDocs => {
  const docs = propDocs(symbol, checker, node);
  const defaultValue = docs.defaultValue ?? meta?.default;
  return {
    ...docs,
    // a prop's comment in runtime props sits on a property the checker's mapped type does not keep
    description: docs.description === "" ? (meta?.description ?? "") : docs.description,
    isRequired: meta?.required ?? docs.isRequired,
    ...(defaultValue === undefined ? {} : { defaultValue })
  };
};

/** The file, beside a component, that restates it where `vue-component-meta` can read it; never on disk. */
const RESTATED_FILE = "forgebook-component.ts";

/**
 * Where `vue-component-meta` can read a component. It reads only an `export default` of a value or an initialised
 * `export const`, so a function declaration, `export { Name }` or a declaration file is restated in a small module of
 * the checker's own, as `export const component = Name`.
 *
 * @param checker - the component's checker.
 * @param place - where it is.
 */
const readablePlace = (checker: ComponentChecker, place: ComponentPlace): ComponentPlace => {
  const program = checker.getProgram();
  const source = program?.getSourceFile(place.file);
  if (program !== undefined && source !== undefined) {
    if (getExport(ts, program, source, place.exportName) !== undefined) return place;
  }
  const file = join(dirname(place.file), RESTATED_FILE).split("\\").join("/");
  const specifier = `./${basename(place.file).replace(/(\.d)?\.[cm]?[jt]sx?$/, "")}`;
  checker.updateFile(
    file,
    `import { ${place.exportName} as Component } from ${JSON.stringify(specifier)};\nexport const component = Component;\n`
  );
  return { file, exportName: "component" };
};

/** What a component takes. */
type ComponentRead = {
  /** Its own props, then its slots, then its events. */
  readonly props: readonly PropDocs[];
  /** Its parts. */
  readonly parts: readonly string[];
  /** The files they come from. */
  readonly sources: readonly string[];
};

/**
 * What a component takes, read from the checker.
 *
 * @param checker - the component's checker.
 * @param place - where it is.
 */
const componentRead = (checker: ComponentChecker, place: ComponentPlace): ComponentRead => {
  const readable = readablePlace(checker, place);
  const meta = checker.getComponentMeta(readable.file, readable.exportName);
  const program = checker.getProgram();
  const source = program?.getSourceFile(readable.file);
  const node =
    program === undefined || source === undefined
      ? undefined
      : getExport(ts, program, source, readable.exportName);
  if (program === undefined || node === undefined)
    throw new Error(`${place.file} has no export ${place.exportName}`);
  const typeChecker = program.getTypeChecker();
  const propsType = inferComponentProps(typeChecker, typeChecker.getTypeAtLocation(node));
  const own = new Map(meta.props.filter((prop) => !prop.global).map((prop) => [prop.name, prop]));
  const symbols = declarationOrder(
    (propsType?.getProperties() ?? []).filter(
      (prop) => own.has(prop.getName()) && ((prop.declarations ?? []).length === 0 || !isForeign(prop))
    ),
    dirname(place.file)
  );
  const props = symbols.map((symbol) => vuePropDocs(symbol, own.get(symbol.getName()), typeChecker, node));
  const comments = emitComments(
    extname(place.file) === SFC ? scriptsOf(ts.sys.readFile(place.file) ?? "") : ""
  );
  return {
    props: [...props, ...meta.slots.map(slotDocs), ...meta.events.map((event) => eventDocs(event, comments))],
    parts: partsOf(propsType, typeChecker, node),
    sources: [
      place.file,
      ...symbols.flatMap((symbol) =>
        (symbol.declarations ?? []).map((declaration) => declaration.getSourceFile().fileName)
      )
    ]
  };
};

/**
 * What a component says of itself: the comment that opens a single-file component's script, or the TSDoc of its
 * declaration and of its file.
 *
 * @param place - where it is.
 * @param symbol - its symbol.
 * @param checker - the program's checker.
 * @param program - the program.
 */
const componentProse = (
  place: ComponentPlace,
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
  program: ts.Program
): Pick<ComponentDocs, "description" | "summary" | "guidance"> => {
  if (extname(place.file) !== SFC) {
    const source = program.getSourceFile(place.file);
    return {
      description: summaryOf(symbol, checker),
      summary: source === undefined ? "" : moduleSummaryOf(source),
      ...guidanceOf(symbol, checker)
    };
  }
  const script = scriptOf(ts.sys.readFile(place.file) ?? "");
  const { description, tags } = scriptComment(script);
  const isModule = tags.some((tag) => tag.name === "module");
  return {
    description: isModule ? "" : description,
    summary: isModule ? description : "",
    ...guidanceOfTags(tags)
  };
};

/**
 * The component a symbol stands for: its file and the export that holds it.
 *
 * @param symbol - the component's declared symbol.
 * @param program - the program.
 * @param fallback - the file when it has no declaration.
 */
const placeOf = (symbol: ts.Symbol, program: ts.Program, fallback: string): ComponentPlace => {
  const file = symbol.declarations?.[0]?.getSourceFile().fileName ?? fallback;
  const source = program.getSourceFile(file);
  const checker = program.getTypeChecker();
  const module = source === undefined ? undefined : checker.getSymbolAtLocation(source);
  const exported = module === undefined ? [] : checker.getExportsOfModule(module);
  const found = exported.find((each) => declaredSymbol(each, checker) === symbol);
  return { file, exportName: found?.getName() ?? symbol.getName() };
};

/** A file's name as a component's (`my-button` → `MyButton`). */
const pascalCase = (name: string): string =>
  name
    .split(/[^A-Za-z0-9]+/)
    .filter((part) => part !== "")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");

/** Whether a symbol stands for a composable or a function rather than a component: a name in camelCase that can be called. */
const isLogic = (symbol: ts.Symbol, checker: ts.TypeChecker, node: ts.Node): boolean =>
  /^[a-z]/.test(symbol.getName()) &&
  symbol.getName() !== "default" &&
  checker.getTypeOfSymbolAtLocation(symbol, node).getCallSignatures().length > 0;

/**
 * A composable's docs: its signature, which a story about logic shows first.
 *
 * @param symbol - the composable's symbol.
 * @param expression - where the code names it.
 * @param program - the program.
 * @param file - the file read, when it has no declaration.
 */
const logicOf = (
  symbol: ts.Symbol,
  expression: ts.Expression,
  program: ts.Program,
  file: string
): StoryComponentResult => {
  const checker = program.getTypeChecker();
  const place = placeOf(symbol, program, file);
  const signature = signatureDocs(symbol, expression, checker);
  return {
    docs: {
      name: symbol.getName(),
      ...componentProse(place, symbol, checker, program),
      props: [],
      parts: [],
      subcomponents: [],
      ...(signature === undefined ? {} : { signature })
    },
    file: place.file,
    sources: [place.file]
  };
};

/**
 * The docs of the subcomponents a story file's meta names, with the files they come from.
 *
 * @param source - the story file, parsed.
 * @param checker - the story file's checker.
 * @param program - its program.
 * @returns the docs and their files, or a message naming the subcomponent that cannot be resolved.
 */
const subcomponentsOf = (
  source: ts.SourceFile,
  checker: ComponentChecker,
  program: ts.Program
): { readonly docs: SubcomponentDocs[]; readonly sources: string[] } | string => {
  const typeChecker = program.getTypeChecker();
  const docs: SubcomponentDocs[] = [];
  const sources: string[] = [];
  for (const subcomponent of metaSubcomponents(source, typeChecker)) {
    const symbol = declaredSymbol(subcomponent.symbol, typeChecker);
    if (symbol === undefined) {
      return `${source.fileName}: the meta's subcomponent ${subcomponent.name} cannot be resolved`;
    }
    const place = placeOf(symbol, program, source.fileName);
    const read = componentRead(checker, place);
    docs.push({
      name: subcomponent.name,
      description: componentProse(place, symbol, typeChecker, program).description,
      props: read.props
    });
    sources.push(...read.sources);
  }
  return { docs, sources };
};

/**
 * A component's docs and the files they come from.
 *
 * @param name - its name.
 * @param symbol - its declared symbol.
 * @param checker - its checker.
 * @param program - the program.
 * @param file - the file read, when it has no declaration.
 * @param subcomponents - the subcomponents' docs and files; none outside a story file.
 */
const componentOf = (
  name: string,
  symbol: ts.Symbol,
  checker: ComponentChecker,
  program: ts.Program,
  file: string,
  subcomponents: { readonly docs: SubcomponentDocs[]; readonly sources: string[] }
): StoryComponentResult => {
  const place = placeOf(symbol, program, file);
  const read = componentRead(checker, place);
  return {
    docs: {
      name,
      ...componentProse(place, symbol, program.getTypeChecker(), program),
      props: read.props,
      parts: read.parts,
      subcomponents: subcomponents.docs
    },
    file: place.file,
    sources: [...new Set([...read.sources, ...subcomponents.sources])]
  };
};

/**
 * What a read gave, or why it threw as a message: the checker throws on what it cannot read, and one such file must not
 * end `forgebook docs` for a whole package.
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

/**
 * A story file's component with the file that declares it.
 *
 * @param storyFile - the story file's absolute path.
 * @returns the component, `{ docs: { name: null } }` when the meta names none, or a message saying why the file
 * cannot be read.
 */
export const extractStoryComponent = (storyFile: string): StoryComponentResult =>
  orMessage(storyFile, () => readStoryComponent(storyFile));

/** Reads a story file's component; `extractStoryComponent` says what can go wrong. */
const readStoryComponent = (storyFile: string): StoryComponentResult => {
  const checker = checkerFor(storyFile);
  const program = checker.getProgram();
  const source = program?.getSourceFile(storyFile);
  if (program === undefined || source === undefined) return `${storyFile} is not in its program`;
  const expression = metaComponent(source);
  if (expression === undefined) return { docs: { name: null } };
  const typeChecker = program.getTypeChecker();
  const symbol = declaredSymbol(typeChecker.getSymbolAtLocation(expression), typeChecker);
  if (symbol === undefined) return `${storyFile}: the meta's component cannot be resolved`;
  if (isLogic(symbol, typeChecker, expression)) return logicOf(symbol, expression, program, storyFile);
  const subcomponents = subcomponentsOf(source, checker, program);
  if (typeof subcomponents === "string") return subcomponents;
  return componentOf(expression.getText(source), symbol, checker, program, storyFile, subcomponents);
};

/**
 * A component a file exports, for writing its first stories (`forgebook new`): a single-file component is its default
 * export, named after its file.
 *
 * @param file - the component's file, absolute.
 * @param exportName - the export to read; the file's only component when none.
 * @returns the component, or a message saying why it cannot be read (no component, several, a name not exported).
 */
export const extractFileComponent = (file: string, exportName?: string): StoryComponentResult =>
  orMessage(file, () => readFileComponent(file, exportName));

/** Reads a component of a file; `extractFileComponent` says what can go wrong. */
const readFileComponent = (file: string, exportName: string | undefined): StoryComponentResult => {
  const checker = checkerFor(file);
  const program = checker.getProgram();
  const source = program?.getSourceFile(file);
  if (program === undefined || source === undefined) return `${file} is not in its program`;
  const typeChecker = program.getTypeChecker();
  const module = typeChecker.getSymbolAtLocation(source);
  if (module === undefined) return `${file} exports nothing`;
  const exported = typeChecker.getExportsOfModule(module);
  const isSfc = extname(file) === SFC;
  const components = exported
    .filter((each) => ((declaredSymbol(each, typeChecker) ?? each).flags & ts.SymbolFlags.Value) !== 0)
    .map((each) => each.getName())
    .filter((name) => (isSfc ? name === "default" : /^[A-Z]/.test(name)));
  const chosen = chosenExport(components, isSfc ? "default" : exportName, file);
  if (typeof chosen !== "string") return chosen.problem;
  const symbol = exported.find((each) => each.getName() === chosen);
  if (symbol === undefined) return `${file} exports no component ${chosen}`;
  const name = isSfc ? pascalCase(basename(file, SFC)) : chosen;
  return componentOf(name, declaredSymbol(symbol, typeChecker) ?? symbol, checker, program, file, {
    docs: [],
    sources: []
  });
};

/**
 * How `forgebook new` writes a Vue component's stories: `.ts`, since a story needs no JSX, a single-file component
 * imported by its default export and with its extension.
 *
 * @param name - the component's name.
 * @param file - the component's file, absolute.
 */
export const storyFileShape = (name: string, file: string): StoryFileShape => ({
  extension: ".stories.ts",
  importStatement:
    extname(file) === SFC
      ? `import ${name} from ${JSON.stringify(`./${basename(file)}`)};`
      : `import { ${name} } from ${JSON.stringify(`./${basename(file).replace(/\.[cm]?[jt]s$/, "")}`)};`
});
