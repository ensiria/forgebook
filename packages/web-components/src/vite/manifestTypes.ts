/**
 * The types a Custom Elements Manifest names but does not spell out, read from the element's source: an analyzer writes
 * a field's type as the source does (`Tone`), so an alias of a union reaches the docs as a name, and the panel would
 * offer no choice for it.
 *
 * @remarks
 * Only a prop whose type is a bare name (`Tone`, `Size<"md">`) and whose element's module is a TypeScript file on disk
 * is read again, from the program that holds that module, through the core's reading of a prop
 * (`forgebook/vite/prop-docs`): its kind, its type spelled out, its choices. Its name, description and default stay the
 * manifest's. Without such a prop no program is built, so a manifest that spells out its types costs nothing more.
 *
 * @module
 */
import type { PropDocs } from "forgebook/component-docs";
import { programFor } from "forgebook/vite/docs-program";
import { propDocs } from "forgebook/vite/prop-docs";
import ts from "typescript-6";

import { argTarget } from "../argNames.ts";
import type { ManifestElement } from "./manifest.ts";

/** A type written as a name, which the manifest does not spell out. */
const NAMED_TYPE = /^[A-Za-z_$][\w$.]*(<.*>)?$/;

/** Names that are what they say: nothing to spell out. */
const PLAIN_TYPES = new Set(["Slot", "unknown", "string", "number", "boolean", "object", "any"]);

/**
 * Whether a prop's type is a name the source can spell out.
 *
 * @param prop - the prop, as the manifest gave it.
 */
const isNamed = (prop: PropDocs): boolean =>
  prop.kind === "other" && !PLAIN_TYPES.has(prop.type) && NAMED_TYPE.test(prop.type);

/**
 * The field an arg sets: an attribute's field, or the property itself.
 *
 * @param element - the element.
 * @param arg - the arg's name.
 */
const fieldOf = (element: ManifestElement, arg: string): string | undefined => {
  const target = argTarget(arg);
  if (target.kind === "property") return target.name;
  if (target.kind !== "attribute") return undefined;
  const attribute = element.attributes.find((each) => each.name === target.name);
  return attribute?.fieldName ?? element.fields.find((field) => field.attribute === target.name)?.name;
};

/**
 * The element's class in its module.
 *
 * @param source - the module, in its program.
 * @param name - the class's name.
 */
const classIn = (source: ts.SourceFile, name: string): ts.ClassDeclaration | undefined =>
  source.statements.find(
    (statement): statement is ts.ClassDeclaration =>
      ts.isClassDeclaration(statement) && statement.name?.text === name
  );

/**
 * The props, those whose type the manifest only names spelled out from the source.
 *
 * @param props - the props, as the manifest gave them.
 * @param element - the element's entry.
 * @param moduleFile - its module's file, absolute; none when it is not on disk.
 */
export const spelledOutProps = (
  props: readonly PropDocs[],
  element: ManifestElement,
  moduleFile: string | undefined
): readonly PropDocs[] => {
  if (moduleFile === undefined || !/\.[cm]?tsx?$/.test(moduleFile) || !props.some(isNamed)) return props;
  const read = programFor(moduleFile);
  const source = typeof read === "string" ? undefined : read.program.getSourceFile(moduleFile);
  const declaration = source === undefined ? undefined : classIn(source, element.name);
  if (typeof read === "string" || declaration?.name === undefined) return props;
  const classSymbol = read.checker.getSymbolAtLocation(declaration.name);
  if (classSymbol === undefined) return props;
  const instance = read.checker.getDeclaredTypeOfSymbol(classSymbol);
  return props.map((prop) => {
    const field = isNamed(prop) ? fieldOf(element, prop.name) : undefined;
    const symbol = field === undefined ? undefined : instance.getProperty(field);
    if (symbol === undefined) return prop;
    const { kind, type, choices, canTakeText } = propDocs(symbol, read.checker, declaration);
    return {
      ...prop,
      kind,
      type,
      ...(choices === undefined ? {} : { choices }),
      ...(canTakeText === undefined ? {} : { canTakeText })
    };
  });
};
