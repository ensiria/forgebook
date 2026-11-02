/**
 * The decorators of an Angular class and its members, read from the source without running them: which decorator, and
 * what it is called with (`@Component({ selector, template })`, `@Input("alias")`).
 *
 * @module
 */
import ts from "typescript-6";

/** An Angular decorator on a class or a member: its name and the object or value it is called with. */
type DecoratorCall = {
  /** The decorator's name (`Component`, `Input`). */
  readonly name: string;
  /** What it is called with. */
  readonly arguments: readonly ts.Expression[];
};

/** The decorators that make a class something Angular draws or applies. */
export const CLASS_DECORATORS = ["Component", "Directive"];

/**
 * The decorators a node carries, by name.
 *
 * @param node - a class or a member.
 */
export const decoratorsOf = (node: ts.Node): DecoratorCall[] =>
  (ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : []).flatMap((decorator): DecoratorCall[] => {
    const call = decorator.expression;
    if (ts.isCallExpression(call) && ts.isIdentifier(call.expression))
      return [{ name: call.expression.text, arguments: call.arguments }];
    return ts.isIdentifier(call) ? [{ name: call.text, arguments: [] }] : [];
  });

/**
 * The object a class's `@Component` or `@Directive` is called with.
 *
 * @param node - the class.
 */
export const classMetadata = (node: ts.ClassDeclaration): ts.ObjectLiteralExpression | undefined => {
  const decorator = decoratorsOf(node).find((each) => CLASS_DECORATORS.includes(each.name));
  const [argument] = decorator?.arguments ?? [];
  return argument !== undefined && ts.isObjectLiteralExpression(argument) ? argument : undefined;
};

/**
 * A property of an object literal, by name.
 *
 * @param object - the object.
 * @param name - the property's name.
 */
export const propertyOf = (
  object: ts.ObjectLiteralExpression | undefined,
  name: string
): ts.Expression | undefined =>
  object?.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
      property.name.text === name
  )?.initializer;

/** A text a literal writes, or none. */
export const textOf = (expression: ts.Expression | undefined): string | undefined =>
  expression !== undefined &&
  (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))
    ? expression.text
    : undefined;
