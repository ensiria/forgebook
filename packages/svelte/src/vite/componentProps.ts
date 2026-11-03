/**
 * What a Svelte component takes, read from its type: its props, a snippet as the arg that fills it with a text
 * (`#children`), a callback prop as an event (`onclick`, as Svelte 5 names them), each prop's default from its
 * `$props()`.
 *
 * @remarks
 * A component's type is `Component<Props>`, as `svelte2tsx` writes a `.svelte` file and as a package declares one, so its
 * props are what it is called with. They read as a React component's do (`forgebook/vite/prop-docs`), from the checker's
 * symbols; what it passes on to an element comes from `node_modules` (`svelte/elements`) and is left out. A default is
 * what the component's `$props()` destructuring gives, `$bindable(value)` included, since the type does not hold it.
 *
 * @module
 */
import { dirname } from "node:path";

import type { PropDocs } from "forgebook/component-docs";
import { declarationOrder, isForeign, partsOf, propDocs } from "forgebook/vite/prop-docs";
import ts from "typescript-6";

import { componentOfScriptFile } from "./svelteSources.ts";

/** A callback prop: `on` and a letter, as Svelte names an element's (`onclick`) and a component's own (`onRemove`). */
const EVENT_NAME = /^on[A-Za-z]/;

/** What a component takes. */
export type ComponentProps = {
  /** Its props, a snippet as `#name`. */
  readonly props: readonly PropDocs[];
  /** Its parts: the keys of its `classNames`, `styles` and `refs` props. */
  readonly parts: readonly string[];
  /** The files its own props are declared in, a component as its `.svelte` file. */
  readonly sources: readonly string[];
};

/** A file as the docs name it: a component's `.svelte` file rather than the TypeScript written for it. */
export const sourceFileOf = (fileName: string): string => componentOfScriptFile(fileName) ?? fileName;

/**
 * The type of a component's props: what its function is called with, or, for a component declared as a class, what its
 * constructor's `props` take.
 *
 * @param type - the component's type.
 * @param checker - the program's checker.
 * @param node - where the code names it.
 */
const propsTypeOf = (type: ts.Type, checker: ts.TypeChecker, node: ts.Node): ts.Type | undefined => {
  const called = type.getCallSignatures().find((signature) => signature.parameters.length >= 2);
  const props = called?.parameters[1];
  if (props !== undefined) return checker.getTypeOfSymbolAtLocation(props, node);
  const options = type.getConstructSignatures()[0]?.parameters[0];
  if (options === undefined) return undefined;
  const fromOptions = checker.getTypeOfSymbolAtLocation(options, node).getProperty("props");
  return fromOptions === undefined ? undefined : checker.getTypeOfSymbolAtLocation(fromOptions, node);
};

/** Whether a type is Svelte's `Snippet`. */
const isSnippet = (type: ts.Type): boolean => {
  const symbol = type.aliasSymbol ?? type.getSymbol();
  return (
    symbol?.getName() === "Snippet" &&
    (symbol.declarations ?? []).some((declaration) =>
      /[\\/]svelte[\\/]types[\\/]/.test(declaration.getSourceFile().fileName)
    )
  );
};

/** Whether a declaration is the component's `$props()` destructuring. */
const isPropsDeclaration = (
  node: ts.Node,
  source: ts.SourceFile
): node is ts.VariableDeclaration & { readonly name: ts.ObjectBindingPattern } =>
  ts.isVariableDeclaration(node) &&
  ts.isObjectBindingPattern(node.name) &&
  node.initializer !== undefined &&
  ts.isCallExpression(node.initializer) &&
  node.initializer.expression.getText(source) === "$props";

/**
 * What a prop's destructuring gives it when it is not passed: its initialiser, or what `$bindable(value)` holds.
 *
 * @param element - the prop's element of the destructuring.
 * @param source - the file.
 * @returns the default as the source writes it, or none.
 */
const defaultOf = (element: ts.BindingElement, source: ts.SourceFile): string | undefined => {
  const written = element.initializer;
  if (element.dotDotDotToken !== undefined || written === undefined) return undefined;
  const isBindable = ts.isCallExpression(written) && written.expression.getText(source) === "$bindable";
  const value = isBindable ? written.arguments[0] : written;
  return value?.getText(source).replace(/\s+/g, " ");
};

/**
 * The defaults a component's `$props()` gives, by prop: `let { tone = "neutral", value = $bindable("") } = $props()`.
 *
 * @param source - the file that declares the component.
 */
const propsDefaults = (source: ts.SourceFile): ReadonlyMap<string, string> => {
  const find = (node: ts.Node): ts.ObjectBindingPattern | undefined =>
    isPropsDeclaration(node, source) ? node.name : ts.forEachChild(node, find);
  const pattern = find(source);
  return new Map(
    (pattern?.elements ?? []).flatMap((element): [string, string][] => {
      const value = defaultOf(element, source);
      return value === undefined ? [] : [[(element.propertyName ?? element.name).getText(source), value]];
    })
  );
};

/**
 * One prop of a component: a snippet as the arg that fills it with a text, a callback prop as an event.
 *
 * @param symbol - the prop.
 * @param checker - the program's checker.
 * @param node - where the code names the component.
 * @param defaults - the defaults its `$props()` gives.
 */
const sveltePropDocs = (
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
  node: ts.Node,
  defaults: ReadonlyMap<string, string>
): PropDocs => {
  const read = propDocs(symbol, checker, node, EVENT_NAME);
  // a component without TypeScript writes its props in JSDoc, whose `@property {T} name - text` keeps the dash
  const docs = { ...read, description: read.description.replace(/^-\s+/, "") };
  const type = checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(symbol, node));
  if (isSnippet(type)) {
    // any text can fill it: the panel offers a field, and the renderer makes the snippet
    return {
      name: `#${docs.name}`,
      kind: "other",
      type: docs.type,
      description: docs.description,
      isRequired: false,
      canTakeText: true
    };
  }
  const defaultValue = docs.defaultValue ?? defaults.get(docs.name);
  return { ...docs, ...(defaultValue === undefined ? {} : { defaultValue }) };
};

/**
 * What a component takes.
 *
 * @param componentSymbol - the component's declared symbol.
 * @param checker - the program's checker.
 * @param node - where the code names the component.
 * @param componentFile - the component's file, for which props are its own.
 * @throws when its type is not a component's.
 */
export const componentProps = (
  componentSymbol: ts.Symbol,
  checker: ts.TypeChecker,
  node: ts.Node,
  componentFile: string
): ComponentProps => {
  const propsType = propsTypeOf(checker.getTypeOfSymbolAtLocation(componentSymbol, node), checker, node);
  if (propsType === undefined) throw new Error(`${componentSymbol.getName()} is not a Svelte component`);
  const declaration = componentSymbol.declarations?.[0]?.getSourceFile();
  const defaults = declaration === undefined ? new Map<string, string>() : propsDefaults(declaration);
  const symbols = declarationOrder(
    propsType.getProperties().filter((prop) => (prop.declarations ?? []).length === 0 || !isForeign(prop)),
    dirname(componentFile)
  );
  return {
    props: symbols.map((symbol) => sveltePropDocs(symbol, checker, node, defaults)),
    parts: partsOf(propsType, checker, node),
    sources: [
      componentFile,
      ...symbols.flatMap((symbol) =>
        (symbol.declarations ?? []).map((each) => sourceFileOf(each.getSourceFile().fileName))
      )
    ]
  };
};
