/**
 * The custom element of a story file, read from its package's Custom Elements Manifest, or from its Lit TypeScript where
 * the manifest does not list it: its attributes, properties, events, slots and parts. The docs module of
 * `@forgebook/web-components`: the plugin's worker and `forgebook-docs` load it through the adapter
 * (`forgebook/vite/adapter`).
 *
 * @remarks
 * The meta names its element by its tag (`component: "my-button"`) or by its class (`component: MyButton`). The manifest
 * answers from the story file alone, with no TypeScript program: the meta is parsed, its tag or class looked up among
 * the manifest's elements. Without a manifest, or for an element it does not list, the story file's program is read: a
 * tag leads to its class through `HTMLElementTagNameMap` or its definition (`elementClass.ts`), and the class's reactive
 * properties and TSDoc give the docs (`litDocs.ts`). In a story, the docs name the element by its tag, which is what the
 * code writer writes; `forgebook new` names it by its class, which the stories it writes import.
 *
 * @module
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, extname } from "node:path";

import type { ComponentDocs, NoComponentDocs, SubcomponentDocs } from "forgebook/component-docs";
import type { StoryComponentResult, StoryFileShape } from "forgebook/vite/adapter";
import { chosenExport, programFor, summaryOf, tagOf } from "forgebook/vite/docs-program";
import { moduleSummaryOf } from "forgebook/vite/module-summary";
import { declaredSymbol } from "forgebook/vite/prop-docs";
import { signatureDocs } from "forgebook/vite/signature-docs";
import { metaComponent, metaField, unwrapped } from "forgebook/vite/story-meta";
import { guidanceOf } from "forgebook/vite/usage-guidance";
import ts from "typescript-6";

import {
  classOfTag,
  type ElementClass,
  elementClassOf,
  isCustomElement,
  tagOfClass
} from "./elementClass.ts";
import { litProps, litTaggedDocs } from "./litDocs.ts";
import {
  insidePackage,
  type Manifest,
  type ManifestElement,
  type ManifestModule,
  manifestFor
} from "./manifest.ts";
import { manifestDocs, manifestProps } from "./manifestDocs.ts";
import { spelledOutProps } from "./manifestTypes.ts";

/** The module a Web Components story file imports its types from, for the stories `forgebook new` writes. */
export const storyTypesModule = "@forgebook/web-components";

/** How a meta names an element: its tag, or its class with the module it imports it from. */
type ElementRef =
  | { readonly tag: string }
  | { readonly className: string; readonly specifier: string | undefined };

/**
 * The module a story file imports a name from.
 *
 * @param name - the imported name.
 * @param source - the story file, parsed.
 */
const importOf = (name: string, source: ts.SourceFile): string | undefined => {
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const clause = statement.importClause;
    const bindings = clause?.namedBindings;
    const isNamed =
      bindings !== undefined &&
      ts.isNamedImports(bindings) &&
      bindings.elements.some((element) => element.name.text === name);
    if (clause?.name?.text === name || isNamed) return statement.moduleSpecifier.text;
  }
  return undefined;
};

/**
 * How an expression of the meta names an element.
 *
 * @param expression - the meta's `component`, or one of its `subcomponents`.
 * @param source - the story file, parsed.
 */
const refOf = (expression: ts.Expression, source: ts.SourceFile): ElementRef | undefined => {
  const inner = unwrapped(expression);
  if (ts.isStringLiteral(inner) || ts.isNoSubstitutionTemplateLiteral(inner)) return { tag: inner.text };
  if (!ts.isIdentifier(inner)) return undefined;
  return { className: inner.text, specifier: importOf(inner.text, source) };
};

/** An element the manifest lists, with its module. */
type Listed = { readonly element: ManifestElement; readonly module: ManifestModule };

/** The file a module's path names, absolute: as written, or its TypeScript source for a `.js` path. */
const moduleFile = (manifest: Manifest, module: ManifestModule): string | undefined => {
  const file = insidePackage(manifest.packageDir, module.path);
  if (file === undefined) return undefined;
  if (existsSync(file)) return file;
  const source = file.replace(/\.js$/, ".ts");
  return existsSync(source) ? source : undefined;
};

/**
 * The element a meta names, among the manifest's: by its tag, or by its class's name, the module it is imported from
 * telling two classes of one name apart.
 *
 * @param manifest - the manifest.
 * @param ref - how the meta names it.
 */
const listedElement = (manifest: Manifest, ref: ElementRef): Listed | undefined => {
  const all = manifest.modules.flatMap((module) => module.elements.map((element) => ({ element, module })));
  if ("tag" in ref) return all.find(({ element }) => element.tagName === ref.tag);
  const named = all.filter(({ element }) => element.name === ref.className);
  if (named.length <= 1 || ref.specifier === undefined) return named[0];
  const stem = basename(ref.specifier).replace(/\.[cm]?[jt]s$/, "");
  return named.find(({ module }) => basename(module.path).replace(/\.[cm]?[jt]s$/, "") === stem);
};

/** An element's docs read from its TypeScript, with the files they come from. */
const litElementDocs = (
  element: ElementClass,
  checker: ts.TypeChecker,
  name: string
): { readonly docs: ComponentDocs; readonly sources: string[] } => {
  const { props, sources } = litProps(element, checker);
  const { slots, events, parts } = litTaggedDocs(element.declaration);
  const description = summaryOf(element.symbol, checker) || (tagOf(element.symbol, checker, "summary") ?? "");
  return {
    docs: {
      name,
      description,
      summary: moduleSummaryOf(element.declaration.getSourceFile().text),
      props: [...props, ...slots, ...events],
      parts,
      subcomponents: [],
      ...guidanceOf(element.symbol, checker)
    },
    sources
  };
};

/** A story file's program, read when the manifest does not answer. */
type StoryProgram = {
  readonly program: ts.Program;
  readonly checker: ts.TypeChecker;
  readonly source: ts.SourceFile;
};

/**
 * The program that holds a story file.
 *
 * @param storyFile - the story file's absolute path.
 * @returns the program and the file in it, or a message when it cannot be read.
 */
const storyProgram = (storyFile: string): StoryProgram | string => {
  const read = programFor(storyFile);
  if (typeof read === "string") return read;
  const source = read.program.getSourceFile(storyFile);
  return source === undefined ? `${storyFile} is not in its program` : { ...read, source };
};

/**
 * The class an expression of the story file names, read in its program: the class itself, or the one its tag is defined
 * with.
 *
 * @param ref - how the meta names it.
 * @param expression - the expression, in the program's own parse of the story file.
 * @param read - the story file's program.
 */
const classOf = (ref: ElementRef, expression: ts.Expression, read: StoryProgram): ElementClass | undefined =>
  "tag" in ref
    ? classOfTag(ref.tag, read.source, read.program)
    : elementClassOf(read.checker.getSymbolAtLocation(unwrapped(expression)), read.checker);

/** Why an element cannot be documented, for a story file's message. */
const notFound = (storyFile: string, ref: ElementRef): string =>
  `${storyFile}: ${"tag" in ref ? `<${ref.tag}>` : ref.className} is in no Custom Elements Manifest and no class of its program defines it`;

/**
 * The subcomponents a meta names, by the name it gives each: `subcomponents: { Item: "my-item", MyIcon }`.
 *
 * @param source - the story file, parsed.
 */
const subcomponentEntries = (
  source: ts.SourceFile
): { readonly name: string; readonly value: ts.Expression }[] => {
  const field = metaField(source, "subcomponents");
  const object = field === undefined ? undefined : unwrapped(field);
  if (object === undefined || !ts.isObjectLiteralExpression(object)) return [];
  return object.properties.flatMap((property) => {
    if (ts.isShorthandPropertyAssignment(property))
      return [{ name: property.name.text, value: property.name }];
    if (!ts.isPropertyAssignment(property)) return [];
    const name =
      ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
        ? property.name.text
        : property.name.getText(source);
    return [{ name, value: property.initializer }];
  });
};

/**
 * The docs of the subcomponents a story file's meta names, from the manifest or the program.
 *
 * @param source - the story file, parsed.
 * @param manifest - the package's manifest, when it has one.
 * @param program - the story file's program, read when first needed.
 */
const subcomponentsOf = (
  source: ts.SourceFile,
  manifest: Manifest | undefined,
  program: () => StoryProgram | string
): Subcomponents | string => {
  const docs: SubcomponentDocs[] = [];
  const sources: string[] = [];
  for (const { name, value } of subcomponentEntries(source)) {
    const ref = refOf(value, source);
    if (ref === undefined) continue;
    const listed = manifest === undefined ? undefined : listedElement(manifest, ref);
    if (manifest !== undefined && listed !== undefined) {
      docs.push({ name, description: listed.element.description, props: manifestProps(listed.element) });
      sources.push(manifest.file);
      continue;
    }
    const read = program();
    if (typeof read === "string") return read;
    // the checker reads its own parse of the file, not this one
    const inProgram = subcomponentEntries(read.source).find((entry) => entry.name === name)?.value ?? value;
    const element = classOf(ref, inProgram, read);
    if (element === undefined) return notFound(source.fileName, ref);
    const found = litElementDocs(element, read.checker, name);
    docs.push({ name, description: found.docs.description, props: found.docs.props });
    sources.push(...found.sources);
  }
  return { docs, sources };
};

/**
 * A function's docs: its signature, which a story about logic shows first.
 *
 * @param symbol - the function's symbol.
 * @param expression - where the code names it.
 * @param checker - the program's checker.
 * @param storyFile - the story file, when it has no declaration.
 */
const logicOf = (
  symbol: ts.Symbol,
  expression: ts.Expression,
  checker: ts.TypeChecker,
  storyFile: string
): StoryComponentResult => {
  const file = symbol.declarations?.[0]?.getSourceFile();
  const signature = signatureDocs(symbol, expression, checker);
  return {
    docs: {
      name: symbol.getName(),
      description: summaryOf(symbol, checker),
      summary: file === undefined ? "" : moduleSummaryOf(file.text),
      props: [],
      parts: [],
      subcomponents: [],
      ...guidanceOf(symbol, checker),
      ...(signature === undefined ? {} : { signature })
    },
    file: file?.fileName ?? storyFile,
    sources: [file?.fileName ?? storyFile]
  };
};

/**
 * What a read gave, or why it threw as a message: one file the compiler cannot read must not end `forgebook docs` for
 * a whole package.
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

/** The subcomponents' docs, with the files they come from. */
type Subcomponents = { readonly docs: SubcomponentDocs[]; readonly sources: string[] };

/**
 * A story file's element as its package's manifest lists it.
 *
 * @param manifest - the manifest.
 * @param listed - the element and its module.
 * @param ref - how the meta names it.
 * @param subcomponents - the subcomponents' docs.
 */
const fromManifest = (
  manifest: Manifest,
  listed: Listed,
  ref: ElementRef,
  subcomponents: Subcomponents
): StoryComponentResult => {
  const file = moduleFile(manifest, listed.module);
  const name = "tag" in ref ? ref.tag : (listed.element.tagName ?? ref.className);
  const docs = manifestDocs(listed.element, listed.module, name);
  return {
    docs: {
      ...docs,
      props: spelledOutProps(docs.props, listed.element, file),
      subcomponents: subcomponents.docs
    },
    file: file ?? manifest.file,
    sources: [...new Set([manifest.file, ...(file === undefined ? [] : [file]), ...subcomponents.sources])]
  };
};

/**
 * A story file's element read from its program: a Lit element's class, or a function a story about logic documents.
 *
 * @param story - the story file's program.
 * @param expression - the meta's component, in the program's parse of the file.
 * @param ref - how the meta names it.
 * @param subcomponents - the subcomponents' docs.
 */
const fromProgram = (
  story: StoryProgram,
  expression: ts.Expression,
  ref: ElementRef,
  subcomponents: Subcomponents
): StoryComponentResult => {
  const storyFile = story.source.fileName;
  if (!("tag" in ref) && /^[a-z]/.test(ref.className)) {
    const symbol = declaredSymbol(story.checker.getSymbolAtLocation(expression), story.checker);
    if (symbol !== undefined) return logicOf(symbol, expression, story.checker, storyFile);
  }
  const element = classOf(ref, expression, story);
  if (element === undefined) return notFound(storyFile, ref);
  const name = "tag" in ref ? ref.tag : (tagOfClass(element, story.checker) ?? ref.className);
  const found = litElementDocs(element, story.checker, name);
  return {
    docs: { ...found.docs, subcomponents: subcomponents.docs },
    file: element.declaration.getSourceFile().fileName,
    sources: [...new Set([...found.sources, ...subcomponents.sources])]
  };
};

/** Reads a story file's element; `extractStoryComponent` says what can go wrong. */
const readStoryComponent = (storyFile: string): StoryComponentResult => {
  const source = ts.createSourceFile(
    storyFile,
    readFileSync(storyFile, "utf8"),
    ts.ScriptTarget.Latest,
    true
  );
  const expression = metaComponent(source);
  if (expression === undefined) return { docs: { name: null } };
  const ref = refOf(expression, source);
  if (ref === undefined) return `${storyFile}: the meta's component is neither a tag nor a class`;
  const manifest = manifestFor(storyFile);
  if (typeof manifest === "string") return manifest;
  let read: StoryProgram | string | undefined;
  const program = (): StoryProgram | string => {
    read ??= storyProgram(storyFile);
    return read;
  };
  const subcomponents = subcomponentsOf(source, manifest, program);
  if (typeof subcomponents === "string") return subcomponents;
  const listed = manifest === undefined ? undefined : listedElement(manifest, ref);
  if (manifest !== undefined && listed !== undefined)
    return fromManifest(manifest, listed, ref, subcomponents);
  const story = program();
  return typeof story === "string"
    ? story
    : fromProgram(story, metaComponent(story.source) ?? expression, ref, subcomponents);
};

/**
 * The docs of a story file's element.
 *
 * @param storyFile - the story file's absolute path.
 * @returns the element's docs, `{ name: null }` when the meta names none, or a message saying why the file cannot be
 * read.
 */
export const extractComponentDocs = (storyFile: string): ComponentDocs | NoComponentDocs | string => {
  const component = extractStoryComponent(storyFile);
  return typeof component === "string" ? component : component.docs;
};

/**
 * A story file's element with the file that declares it.
 *
 * @param storyFile - the story file's absolute path.
 * @returns the element, `{ docs: { name: null } }` when the meta names none, or a message saying why the file cannot
 * be read.
 */
export const extractStoryComponent = (storyFile: string): StoryComponentResult =>
  orMessage(storyFile, () => readStoryComponent(storyFile));

/** Reads an element of a file; `extractFileComponent` says what can go wrong. */
const readFileComponent = (file: string, exportName: string | undefined): StoryComponentResult => {
  const manifest = manifestFor(file);
  if (typeof manifest === "string") return manifest;
  const module = manifest?.modules.find((each) => moduleFile(manifest, each) === file);
  if (manifest !== undefined && module !== undefined && module.elements.length > 0) {
    const chosen = chosenExport(
      module.elements.map((element) => element.name),
      exportName,
      file
    );
    if (typeof chosen !== "string") return chosen.problem;
    const element = module.elements.find((each) => each.name === chosen);
    if (element !== undefined) {
      const docs = manifestDocs(element, module, element.name);
      return {
        docs: { ...docs, props: spelledOutProps(docs.props, element, file) },
        file,
        sources: [manifest.file, file]
      };
    }
  }
  const read = storyProgram(file);
  if (typeof read === "string") return read;
  const moduleSymbol = read.checker.getSymbolAtLocation(read.source);
  if (moduleSymbol === undefined) return `${file} exports nothing`;
  const elements = read.checker.getExportsOfModule(moduleSymbol).flatMap((each) => {
    const element = elementClassOf(each, read.checker);
    return element !== undefined && isCustomElement(element, read.checker)
      ? [{ name: each.getName(), element }]
      : [];
  });
  const chosen = chosenExport(
    elements.map((each) => each.name),
    exportName,
    file
  );
  if (typeof chosen !== "string") return chosen.problem.replace(/component/g, "custom element");
  const found = elements.find((each) => each.name === chosen);
  if (found === undefined) return `${file} exports no custom element ${chosen}`;
  const { docs, sources } = litElementDocs(found.element, read.checker, chosen);
  return { docs, file, sources };
};

/**
 * An element a file exports, for writing its first stories (`forgebook new`): named by its class, which the stories
 * import, and which defines the element as its module loads.
 *
 * @param file - the element's file, absolute.
 * @param exportName - the class to read; the file's only custom element when none.
 * @returns the element, or a message saying why it cannot be read (no custom element, several, a name not exported).
 */
export const extractFileComponent = (file: string, exportName?: string): StoryComponentResult =>
  orMessage(file, () => readFileComponent(file, exportName));

/**
 * How `forgebook new` writes an element's stories: `.ts`, since a story needs no JSX, the class imported by its name.
 *
 * @param name - the class's name.
 * @param file - the element's file, absolute.
 */
export const storyFileShape = (name: string, file: string): StoryFileShape => ({
  extension: ".stories.ts",
  importStatement: `import { ${name} } from ${JSON.stringify(`./${basename(file, extname(file))}`)};`
});
