/**
 * A Lit element's docs read from its TypeScript, for an element no Custom Elements Manifest lists: its reactive
 * properties, and the events, slots and parts its class's TSDoc names, as the manifest's analyzer reads them.
 *
 * @remarks
 * A reactive property is a field with `@property()`, or a key of `static properties` (`static get properties()` too),
 * the way Lit declares one in TypeScript and in JavaScript; `@state()` and `state: true` are internal and left out, and
 * so is a field whose name is private (`_name`, `#name`, `private`). Its attribute is the one its options name, its name
 * in lowercase without any (Lit's own rule), or none for `attribute: false`, which makes it a property arg (`.items`).
 * Its type, description and choices are read by the core (`forgebook/vite/prop-docs`), its default from its
 * `@defaultValue` or its initial value. Bases declared in the project are read too, the class's own properties first.
 *
 * Events come from `@fires` and `@event` (`@fires {CustomEvent<string>} change - When the value changes`) and from the
 * events the class dispatches with a literal name (`this.dispatchEvent(new CustomEvent("change"))`); slots from `@slot`
 * (`@slot - The label`, `@slot icon - An icon`); parts from `@csspart`.
 *
 * @module
 */
import type { PropDocs } from "forgebook/component-docs";
import { tagOf } from "forgebook/vite/docs-program";
import { propDocs } from "forgebook/vite/prop-docs";
import ts from "typescript-6";

import { eventArg, propertyArg, slotArg } from "../argNames.ts";
import { type ElementClass, elementClassOf } from "./elementClass.ts";

/** A reactive property: its field's name and the attribute that sets it, if any. */
type ReactiveProperty = {
  /** The field's name. */
  readonly name: string;
  /** The attribute's name; none for `attribute: false`. */
  readonly attribute: string | undefined;
  /** Where it is declared: the field, or its key in `static properties`. */
  readonly node: ts.Node;
};

/** A property assignment's value in an object literal, by its key. */
const optionOf = (options: ts.Expression | undefined, key: string): ts.Expression | undefined => {
  if (options === undefined || !ts.isObjectLiteralExpression(options)) return undefined;
  const found = options.properties.find(
    (property) => ts.isPropertyAssignment(property) && property.name.getText() === key
  );
  return found !== undefined && ts.isPropertyAssignment(found) ? found.initializer : undefined;
};

/**
 * The attribute a property's options give it, Lit's way.
 *
 * @param name - the field's name.
 * @param options - its options object; none when it has none.
 * @returns the attribute, none for `attribute: false`, or `false` for an internal state.
 */
const attributeOf = (name: string, options: ts.Expression | undefined): string | undefined | false => {
  if (optionOf(options, "state")?.kind === ts.SyntaxKind.TrueKeyword) return false;
  const attribute = optionOf(options, "attribute");
  if (attribute?.kind === ts.SyntaxKind.FalseKeyword) return undefined;
  if (
    attribute !== undefined &&
    (ts.isStringLiteral(attribute) || ts.isNoSubstitutionTemplateLiteral(attribute))
  )
    return attribute.text;
  return name.toLowerCase();
};

/** Whether a member's name or modifiers keep it internal. */
const isInternal = (member: ts.ClassElement): boolean =>
  member.name === undefined ||
  ts.isPrivateIdentifier(member.name) ||
  member.name.getText().startsWith("_") ||
  (ts.getCombinedModifierFlags(member) & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) !== 0;

/** The object a `static properties` member writes: its initializer, or what its getter returns. */
const staticProperties = (member: ts.ClassElement): ts.ObjectLiteralExpression | undefined => {
  const isStatic = (ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Static) !== 0;
  if (member.name?.getText() !== "properties" || !isStatic) return undefined;
  let value: ts.Expression | undefined;
  if (ts.isPropertyDeclaration(member)) value = member.initializer;
  if (ts.isGetAccessorDeclaration(member))
    value = member.body?.statements.find(ts.isReturnStatement)?.expression;
  return value !== undefined && ts.isObjectLiteralExpression(value) ? value : undefined;
};

/**
 * The reactive properties a class declares itself, in the order written.
 *
 * @param declaration - the class.
 */
const ownReactiveProperties = (declaration: ts.ClassLikeDeclaration): ReactiveProperty[] =>
  declaration.members.flatMap((member): ReactiveProperty[] => {
    const listed = staticProperties(member);
    if (listed !== undefined) {
      return listed.properties.flatMap((entry): ReactiveProperty[] => {
        if (!ts.isPropertyAssignment(entry) || entry.name.getText().startsWith("_")) return [];
        const name = entry.name.getText().replace(/^["']|["']$/g, "");
        const attribute = attributeOf(name, entry.initializer);
        return attribute === false ? [] : [{ name, attribute, node: entry }];
      });
    }
    if (isInternal(member) || !ts.canHaveDecorators(member)) return [];
    // among the member's decorators (`@consume(…) @property(…)`), the one that makes it reactive
    const call = (ts.getDecorators(member) ?? [])
      .map((decorator) => decorator.expression)
      .find(
        (expression): expression is ts.CallExpression =>
          ts.isCallExpression(expression) && expression.expression.getText() === "property"
      );
    if (call === undefined) return [];
    const name = member.name?.getText() ?? "";
    const attribute = attributeOf(name, call.arguments[0]);
    return attribute === false ? [] : [{ name, attribute, node: member }];
  });

/** The class a class extends, when the project declares it. */
const baseOf = (element: ElementClass, checker: ts.TypeChecker): ElementClass | undefined => {
  const clause = element.declaration.heritageClauses?.find(
    (each) => each.token === ts.SyntaxKind.ExtendsKeyword
  );
  const expression = clause?.types[0]?.expression;
  const base =
    expression === undefined ? undefined : elementClassOf(checker.getSymbolAtLocation(expression), checker);
  return base === undefined || base.declaration.getSourceFile().fileName.includes("/node_modules/")
    ? undefined
    : base;
};

/** A field's initial value as code: its initializer, or what the constructor assigns it. */
const initialValue = (
  property: ReactiveProperty,
  declaration: ts.ClassLikeDeclaration
): string | undefined => {
  if (ts.isPropertyDeclaration(property.node) && property.node.initializer !== undefined)
    return property.node.initializer.getText();
  const body = declaration.members.find(ts.isConstructorDeclaration)?.body;
  for (const statement of body?.statements ?? []) {
    if (!ts.isExpressionStatement(statement) || !ts.isBinaryExpression(statement.expression)) continue;
    const { left, operatorToken, right } = statement.expression;
    const isThisField =
      ts.isPropertyAccessExpression(left) &&
      left.expression.kind === ts.SyntaxKind.ThisKeyword &&
      left.name.text === property.name;
    if (isThisField && operatorToken.kind === ts.SyntaxKind.EqualsToken) return right.getText();
  }
  return undefined;
};

/**
 * One reactive property's docs, under the arg that sets it.
 *
 * @param property - the property.
 * @param symbol - its symbol in the element's instance type; none for a key of `static properties` no field declares.
 * @param declaration - the class that declares it.
 * @param checker - the program's checker.
 */
const reactivePropDocs = (
  property: ReactiveProperty,
  symbol: ts.Symbol | undefined,
  declaration: ts.ClassLikeDeclaration,
  checker: ts.TypeChecker
): PropDocs => {
  const name = property.attribute ?? propertyArg(property.name);
  if (symbol === undefined)
    return { name, kind: "other", type: "unknown", description: "", isRequired: false };
  const read: PropDocs = { ...propDocs(symbol, checker, declaration), name, isRequired: false };
  const initial = tagOf(symbol, checker, "defaultValue") ?? initialValue(property, declaration);
  return initial === undefined ? read : { ...read, defaultValue: initial };
};

/**
 * An element's reactive properties as props, its own first, then its bases'.
 *
 * @param element - the class.
 * @param checker - the program's checker.
 * @returns the props, and the files they are declared in.
 */
export const litProps = (
  element: ElementClass,
  checker: ts.TypeChecker
): { readonly props: PropDocs[]; readonly sources: string[] } => {
  const instance = checker.getDeclaredTypeOfSymbol(element.symbol);
  const props: PropDocs[] = [];
  const sources: string[] = [];
  const seen = new Set<string>();
  for (
    let current: ElementClass | undefined = element;
    current !== undefined;
    current = baseOf(current, checker)
  ) {
    sources.push(current.declaration.getSourceFile().fileName);
    for (const property of ownReactiveProperties(current.declaration)) {
      if (seen.has(property.name)) continue;
      seen.add(property.name);
      props.push(
        reactivePropDocs(property, instance.getProperty(property.name), current.declaration, checker)
      );
    }
  }
  return { props, sources };
};

/** One tag of a class's TSDoc, read Lit's way: `{Type} name - description`, each part optional. */
type ElementTag = {
  /** The tag's name (`fires`, `slot`). */
  readonly tag: string;
  /** The type in braces, when written. */
  readonly type: string | undefined;
  /** The name; empty for the unnamed slot (`@slot - …`). */
  readonly name: string;
  /** The description. */
  readonly description: string;
};

/** The parts of a tag's text. */
const TAG_TEXT = /^(?:\{([^}]*)\}\s*)?(?:(\S+)\s*)?(?:-\s*)?([\s\S]*)$/;

/**
 * A class's TSDoc tags of the given names.
 *
 * @param declaration - the class.
 * @param names - the tags read (`fires`, `event`).
 */
const elementTags = (declaration: ts.ClassLikeDeclaration, names: readonly string[]): ElementTag[] =>
  ts.getJSDocTags(declaration).flatMap((tag): ElementTag[] => {
    if (!names.includes(tag.tagName.text)) return [];
    const text = (ts.getTextOfJSDocComment(tag.comment) ?? "").trim();
    const [, type, name = "", description = ""] = TAG_TEXT.exec(text) ?? [];
    const isUnnamed = name === "-";
    return [
      {
        tag: tag.tagName.text,
        type: type?.trim(),
        name: isUnnamed ? "" : name,
        description: (isUnnamed ? text.replace(/^(?:\{[^}]*\}\s*)?-\s*/, "") : description)
          .replace(/\s+/g, " ")
          .trim()
      }
    ];
  });

/**
 * The events a class dispatches with a literal name: `new CustomEvent("change")`, `new Event("close")`.
 *
 * @param declaration - the class.
 */
const dispatchedEvents = (declaration: ts.ClassLikeDeclaration): { name: string; type: string }[] => {
  const found: { name: string; type: string }[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && /Event$/.test(node.expression.text)) {
      const [first] = node.arguments ?? [];
      if (first !== undefined && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)))
        found.push({ name: first.text, type: node.expression.text });
    }
    ts.forEachChild(node, visit);
  };
  visit(declaration);
  return found;
};

/**
 * An element's slots, events and parts, from its class's TSDoc and code.
 *
 * @param declaration - the class.
 */
export const litTaggedDocs = (
  declaration: ts.ClassLikeDeclaration
): { readonly slots: PropDocs[]; readonly events: PropDocs[]; readonly parts: string[] } => {
  const slots = elementTags(declaration, ["slot"]).map(
    (slot): PropDocs => ({
      name: slotArg(slot.name),
      kind: "other",
      type: "Slot",
      description: slot.description,
      isRequired: false,
      canTakeText: true
    })
  );
  const written = elementTags(declaration, ["fires", "event"]).filter((event) => event.name !== "");
  const listed = written.map((event) => ({
    name: event.name,
    type: event.type ?? "Event",
    description: event.description
  }));
  // an event the code dispatches and no tag names, once each
  for (const event of dispatchedEvents(declaration)) {
    if (!listed.some((each) => each.name === event.name)) listed.push({ ...event, description: "" });
  }
  const events = listed.map(
    (event): PropDocs => ({
      name: eventArg(event.name),
      kind: "event",
      type: `(event: ${event.type}) => void`,
      description: event.description,
      isRequired: false,
      signature: { parameters: [{ name: "event", type: event.type }], returns: "void" }
    })
  );
  const parts = elementTags(declaration, ["csspart", "part"]).map((part) => part.name);
  return { slots, events, parts };
};
