/**
 * A prop's kind from a type written as text, as a Custom Elements Manifest gives it (`"primary" | "danger"`,
 * `boolean`, `number | undefined`): the panel's group and control, decided as the core decides it from a checker's type
 * (`forgebook/vite/prop-docs`).
 *
 * @remarks
 * The text is parsed as a TypeScript type, never evaluated: a union of string or number literals is a choice, in the
 * order written; `string`, `number` and `boolean` are text, a number and a toggle; anything else cannot be set from the
 * panel, unless it takes a plain `string`, when the panel offers a text field. `undefined` and `null` are left out, as
 * the core leaves them out. Pure.
 *
 * @module
 */
import type { PropDocs } from "forgebook/component-docs";
import ts from "typescript-6";

/** What a type's text says of a prop. */
export type TypeTextDocs = Pick<PropDocs, "kind" | "type" | "choices" | "canTakeText">;

/**
 * A type node's members: a union's, or the node alone; parentheses taken away.
 *
 * @param node - the type.
 */
const membersOf = (node: ts.TypeNode): ts.TypeNode[] => {
  if (ts.isParenthesizedTypeNode(node)) return membersOf(node.type);
  return ts.isUnionTypeNode(node) ? node.types.flatMap(membersOf) : [node];
};

/** Whether a member is `undefined` or `null`, which every optional value may be. */
const isNothing = (node: ts.TypeNode): boolean =>
  node.kind === ts.SyntaxKind.UndefinedKeyword ||
  (ts.isLiteralTypeNode(node) && node.literal.kind === ts.SyntaxKind.NullKeyword);

/** A literal member's value, or none for any other member. */
const literalValue = (node: ts.TypeNode): string | number | undefined => {
  if (!ts.isLiteralTypeNode(node)) return undefined;
  const { literal } = node;
  if (ts.isStringLiteral(literal) || ts.isNoSubstitutionTemplateLiteral(literal)) return literal.text;
  if (ts.isNumericLiteral(literal)) return Number(literal.text);
  if (
    ts.isPrefixUnaryExpression(literal) &&
    literal.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(literal.operand)
  )
    return -Number(literal.operand.text);
  return undefined;
};

/** Whether a member is `true` or `false`, which together make `boolean`. */
const isBooleanLiteral = (node: ts.TypeNode): boolean =>
  ts.isLiteralTypeNode(node) &&
  (node.literal.kind === ts.SyntaxKind.TrueKeyword || node.literal.kind === ts.SyntaxKind.FalseKeyword);

/**
 * What a type's text says of a prop.
 *
 * @param text - the type as written; none when the manifest writes none.
 */
export const typeTextDocs = (text: string | undefined): TypeTextDocs => {
  if (text === undefined || text.trim() === "") return { kind: "other", type: "unknown" };
  const source = ts.createSourceFile("type.ts", `type Written = ${text};`, ts.ScriptTarget.Latest, true);
  const [alias] = source.statements;
  if (alias === undefined || !ts.isTypeAliasDeclaration(alias)) return { kind: "other", type: text.trim() };
  const members = membersOf(alias.type).filter((member) => !isNothing(member));
  const type = members.map((member) => member.getText(source)).join(" | ");
  if (
    members.length > 0 &&
    members.every((member) => member.kind === ts.SyntaxKind.BooleanKeyword || isBooleanLiteral(member))
  )
    return { kind: "toggle", type };
  const values = members.map(literalValue);
  if (members.length > 0 && values.every((value) => value !== undefined))
    return { kind: "choice", type, choices: values.filter((value) => value !== undefined) };
  const [only] = members;
  if (members.length === 1 && only?.kind === ts.SyntaxKind.StringKeyword) return { kind: "text", type };
  if (members.length === 1 && only?.kind === ts.SyntaxKind.NumberKeyword) return { kind: "number", type };
  const canTakeText = members.some((member) => member.kind === ts.SyntaxKind.StringKeyword);
  return canTakeText ? { kind: "other", type, canTakeText } : { kind: "other", type };
};
