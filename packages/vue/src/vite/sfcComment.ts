/**
 * What a single-file component says of itself: the comment that opens its script. A `.vue` file has no declaration a
 * TSDoc comment can sit on, so its opening comment is the component's, with its summary and its tags.
 *
 * @module
 */
import type { DocTag } from "forgebook/vite/usage-guidance";
import ts from "typescript-6";

/** The comment that opens a script. */
export type ScriptComment = {
  /** Its first paragraph, on one line; empty without a comment. */
  readonly description: string;
  /** Its tags. */
  readonly tags: readonly DocTag[];
};

/**
 * A comment's first paragraph, on one line.
 *
 * @param doc - the comment.
 */
const firstParagraph = (doc: ts.JSDoc): string =>
  ((ts.getTextOfJSDocComment(doc.comment) ?? "").split(/\n\s*\n/)[0] ?? "").replace(/\s+/g, " ").trim();

/**
 * The comment a script opens with, read by TypeScript's own parser of TSDoc.
 *
 * @param script - the script's text.
 */
export const scriptComment = (script: string): ScriptComment => {
  const [range] = ts.getLeadingCommentRanges(script, 0) ?? [];
  const comment = range === undefined ? "" : script.slice(range.pos, range.end);
  if (!comment.startsWith("/**")) return { description: "", tags: [] };
  // a statement to hold it: a comment alone in a file belongs to nothing
  const source = ts.createSourceFile(
    "comment.ts",
    `${comment}\nconst held = 0;`,
    ts.ScriptTarget.Latest,
    true
  );
  const [statement] = source.statements;
  const [doc] = statement === undefined ? [] : ts.getJSDocCommentsAndTags(statement).filter(ts.isJSDoc);
  if (doc === undefined) return { description: "", tags: [] };
  return {
    description: firstParagraph(doc),
    tags: (doc.tags ?? []).map((tag) => ({
      name: tag.tagName.text,
      text: (ts.getTextOfJSDocComment(tag.comment) ?? "").trim()
    }))
  };
};

/**
 * The type a script's `defineEmits` is given: written in place, or the name of a type of the same script.
 *
 * @param source - the script, parsed.
 */
const emitsType = (source: ts.SourceFile): ts.Node | undefined => {
  const find = (node: ts.Node): ts.TypeNode | undefined => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "defineEmits")
      return node.typeArguments?.[0];
    return ts.forEachChild(node, find);
  };
  const written = find(source);
  if (written === undefined || !ts.isTypeReferenceNode(written)) return written;
  const name = written.typeName.getText(source);
  return source.statements.find(
    (statement) =>
      (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) &&
      statement.name.text === name
  );
};

/**
 * What a script's `defineEmits` says of each event. `vue-component-meta` reads an event's comment only from a call
 * signature; the tuple form Vue recommends (`remove: [id: string]`) loses it on the way to the component's type.
 *
 * @param script - the script's text.
 * @returns each event's description, by its name.
 */
export const emitComments = (script: string): ReadonlyMap<string, string> => {
  const source = ts.createSourceFile("script.ts", script, ts.ScriptTarget.Latest, true);
  const type = emitsType(source);
  if (type === undefined) return new Map();
  const declared = ts.isTypeAliasDeclaration(type) ? type.type : type;
  const members =
    ts.isTypeLiteralNode(declared) || ts.isInterfaceDeclaration(declared) ? declared.members : [];
  return new Map(
    [...members].flatMap((member): [string, string][] => {
      const [doc] = ts.getJSDocCommentsAndTags(member).filter(ts.isJSDoc);
      const name = member.name;
      if (doc === undefined || name === undefined) return [];
      return ts.isIdentifier(name) || ts.isStringLiteral(name) ? [[name.text, firstParagraph(doc)]] : [];
    })
  );
};
