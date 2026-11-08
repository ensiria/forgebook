/**
 * The repair round of `forgebook new --repair`: the new stories are drawn, and a story whose component says it needs to
 * be drawn inside another one (`useSidebar must be used within a SidebarProvider`) gets that component as a decorator,
 * found in the application by its name; then they are drawn again, at most `MAX_ROUNDS` times.
 *
 * @remarks
 * Only what the error names is added, and only a component the application exports: a context's value (`X.Provider`)
 * or a store cannot be made up, so those are named for a person or an agent to give. The browser run is the caller's
 * (`check`), so the round itself is tested without one.
 *
 * @module
 */
import ts from "typescript-6";

import type { StoryCheckReport } from "../../src/storyCheck.ts";
import { programFor } from "../../src/vite/docsProgram.ts";
import { VITE_PATHS } from "../../src/vite/vitePaths.ts";
import type { StoryWrapper } from "./newStories.ts";

/** How many times the stories are drawn again after a repair. */
export const MAX_ROUNDS = 2;

/**
 * The component an error says the story must be drawn inside: the words React libraries and applications use for it
 * ("must be used within", "can only be used inside", "is missing a parent"), then the component's name.
 */
const NEEDED_WRAPPER =
  /(?:must be (?:used|placed|rendered|wrapped)|can only be used|may be used only|should be used|has to be used|only be used|used outside)\s*(?:within|in|inside|with|by|under)?\s*(?:the context of\s+)?(?:the\s+|an?\s+|a descendant of\s+)?[`<"']?([A-Z][\w.]*)/;

/** Names a wrapper cannot have in a story file: they are the file's own (`Story`, `Meta`) or the component's. */
const RESERVED = new Set(["Story", "Meta", "React"]);

/** A file that is not the application: a story, a test, a declaration, a dependency. */
const NOT_APPLICATION = /\.(?:stories|story|test|spec)\.[cm]?[jt]sx?$|\.d\.[cm]?ts$|[\\/]node_modules[\\/]/;

/**
 * The components a report's failures say their stories must be drawn inside, each once, in the order met.
 *
 * @param report - the new stories' check.
 * @returns the names; a context's provider (`Theme.Provider`) is left out, since its value cannot be made up.
 */
export const neededWrappers = (report: StoryCheckReport): string[] => {
  const names = report.results.flatMap((result) =>
    result.problems.flatMap((problem) => {
      const name = NEEDED_WRAPPER.exec(problem.message)?.[1]?.replace(/\.$/, "");
      return name === undefined || name.includes(".") || RESERVED.has(name) ? [] : [name];
    })
  );
  return [...new Set(names)];
};

/** Whether a symbol's value is a component: a function, or a class. */
const isComponent = (symbol: ts.Symbol, checker: ts.TypeChecker): boolean => {
  const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
  if (declaration === undefined) return false;
  const type = checker.getTypeOfSymbolAtLocation(symbol, declaration);
  return type.getCallSignatures().length > 0 || type.getConstructSignatures().length > 0;
};

/** The props a function component must be given besides its children: a wrapper written with none would not draw. */
const requiredProps = (symbol: ts.Symbol, checker: ts.TypeChecker): string[] => {
  const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
  if (declaration === undefined) return [];
  const [signature] = checker.getTypeOfSymbolAtLocation(symbol, declaration).getCallSignatures();
  const [props] = signature?.getParameters() ?? [];
  if (props === undefined) return [];
  return checker
    .getTypeOfSymbolAtLocation(props, declaration)
    .getProperties()
    .filter((prop) => (prop.flags & ts.SymbolFlags.Optional) === 0 && prop.getName() !== "children")
    .map((prop) => prop.getName());
};

/** The name a declaration gives its symbol: `SidebarProvider` for `export default function SidebarProvider()`. */
const declaredName = (symbol: ts.Symbol): string => {
  const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
  const name = declaration === undefined ? undefined : ts.getNameOfDeclaration(declaration);
  return name !== undefined && ts.isIdentifier(name) ? name.text : symbol.getName();
};

/** A component the application exports under a name: its file, whether it is the default export, its required props. */
type Exported = { readonly file: string; readonly isDefault: boolean; readonly required: readonly string[] };

/** The application's exports of a component by a name, from the component's program read whole. */
const exportsNamed = (componentFile: string, name: string): Exported[] => {
  const program = programFor(componentFile, { reach: "whole" });
  if (typeof program === "string") return [];
  const { checker } = program;
  return program.program.getSourceFiles().flatMap((source): Exported[] => {
    if (NOT_APPLICATION.test(source.fileName) || program.program.isSourceFileFromExternalLibrary(source))
      return [];
    if (!source.text.includes(name)) return [];
    const moduleSymbol = checker.getSymbolAtLocation(source);
    if (moduleSymbol === undefined) return [];
    return checker.getExportsOfModule(moduleSymbol).flatMap((each): Exported[] => {
      const symbol = (each.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(each) : each;
      const isNamed = each.getName() === name;
      const isDefaultNamed = each.getName() === "default" && declaredName(symbol) === name;
      if ((!isNamed && !isDefaultNamed) || !isComponent(symbol, checker)) return [];
      // a barrel's re-export is the same component: it is imported from where it is declared
      const declaredIn = symbol.valueDeclaration?.getSourceFile().fileName ?? source.fileName;
      const isOwn = declaredIn === source.fileName;
      return isOwn || !isNamed
        ? [{ file: source.fileName, isDefault: !isNamed, required: requiredProps(symbol, checker) }]
        : [];
    });
  });
};

/**
 * The component of the application a story must be drawn inside, as a wrapper the story file imports.
 *
 * @param componentFile - the component's file, absolute.
 * @param storyFile - the story file the import is written in, absolute.
 * @param name - the component's name, as the error gives it.
 * @returns the wrapper; none when the application exports no such component, or several in places equally near.
 */
export const wrapperFor = (
  componentFile: string,
  storyFile: string,
  name: string
): StoryWrapper | undefined => {
  const found = exportsNamed(componentFile, name);
  const component = VITE_PATHS.normalize(componentFile);
  const folder = VITE_PATHS.dirname(component);
  // the nearest wins: the component's own file (a compound's parts), then its folder, then the only one
  const chosen =
    found.find((each) => VITE_PATHS.normalize(each.file) === component) ??
    found.find((each) => VITE_PATHS.dirname(VITE_PATHS.normalize(each.file)) === folder) ??
    (found.length === 1 ? found[0] : undefined);
  if (chosen === undefined) return undefined;
  const relative = VITE_PATHS.relative(VITE_PATHS.dirname(VITE_PATHS.normalize(storyFile)), chosen.file);
  const path = (relative.startsWith(".") ? relative : `./${relative}`).replace(/\.[cm]?[jt]sx?$/, "");
  return {
    name,
    importStatement: chosen.isDefault
      ? `import ${name} from ${JSON.stringify(path)};`
      : `import { ${name} } from ${JSON.stringify(path)};`
  };
};

/** What a repair round did. */
export type RepairOutcome = {
  /** The wrappers the stories are now drawn inside, outermost first. */
  readonly wrappers: readonly StoryWrapper[];
  /**
   * The components an error named that the application does not export as a component it can draw with no props, in the
   * component's package, or that the last draw still names: for a person or an agent to give in a decorator.
   */
  readonly notFound: readonly string[];
  /** The last check's report; a text when the stories could not be drawn. */
  readonly report: StoryCheckReport | string;
};

/**
 * Draws the new stories, adds what their errors name as wrappers, writes them again and draws them again.
 *
 * @param input - the files, how to check the stories, and how to write them with wrappers.
 */
export const repairRounds = async (input: {
  readonly componentFile: string;
  readonly storyFile: string;
  readonly check: () => Promise<StoryCheckReport | string>;
  readonly write: (wrappers: readonly StoryWrapper[]) => Promise<void>;
  readonly find?: (name: string) => StoryWrapper | undefined;
  readonly packageDir?: string;
}): Promise<RepairOutcome> => {
  const find =
    input.find ??
    ((name: string): StoryWrapper | undefined => wrapperFor(input.componentFile, input.storyFile, name));
  let wrappers: readonly StoryWrapper[] = [];
  const notFound = new Set<string>();
  let report = await input.check();
  for (let round = 0; round < MAX_ROUNDS && typeof report !== "string"; round += 1) {
    const names = neededWrappers(report).filter(
      (name) => !notFound.has(name) && !wrappers.some((each) => each.name === name)
    );
    const added = names.flatMap((name) => {
      const wrapper = find(name);
      if (wrapper === undefined) notFound.add(name);
      return wrapper === undefined ? [] : [wrapper];
    });
    if (added.length === 0) break;
    // what an inner wrapper needs goes around it
    wrappers = [...added, ...wrappers];
    await input.write(wrappers);
    report = await input.check();
  }
  // what the last draw still names was never tried: it is said with what was not found
  if (typeof report !== "string")
    for (const name of neededWrappers(report))
      if (!wrappers.some((each) => each.name === name)) notFound.add(name);
  return { wrappers, notFound: [...notFound], report };
};
