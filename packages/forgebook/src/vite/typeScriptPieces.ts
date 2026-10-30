/**
 * Code of the TypeScript family (TypeScript, TSX, JavaScript, JSX) split into the pieces a reader tells apart, from
 * the TypeScript compiler's syntactic classifications, for `highlightCode.ts` to colour (D-690).
 *
 * @remarks
 * highlight.js has no JSX grammar: it reads JSX as HTML, so an attribute holding a function or a `>` ends the tag
 * early and the rest of the example is left plain. The compiler parses JSX as the language defines it.
 *
 * One language service in syntactic mode, created on the first block and kept: it parses the block alone (no
 * program, no library, no type checker), so a block costs a parse, not a type check. Its classifications tell
 * keywords, literals (a regular expression among the strings), comments, JSX and the names declared by a class, an
 * interface, an enum, a namespace or a type parameter apart; a name they leave as a plain identifier is placed from
 * the block's syntax tree: a type where a type is written, a function where it is called or declared, a property
 * where it is read or declared (D-691). The rest (operators, punctuation, plain names, JSX text) stays plain.
 *
 * The pieces are slices of the code, in order, covering it whole: the caller escapes each one, so a coloured piece
 * never splits an HTML entity.
 *
 * @module
 */
import ts from "typescript-6";

/** What a coloured piece of code is, which is its colour. */
export type CodeRole =
  | "keyword"
  | "string"
  | "number"
  | "comment"
  | "type"
  | "function"
  | "property"
  | "tag"
  | "attribute";

/** A slice of a block of code, with what it is when it is coloured. */
export type CodePiece = {
  /** The slice, as written. */
  readonly text: string;
  /** What it is; none leaves it plain. */
  readonly role?: CodeRole;
};

/** The fence names of the TypeScript family, and the kind of file each one is parsed as. */
const SCRIPT_KINDS: Readonly<Record<string, ts.ScriptKind>> = {
  ts: ts.ScriptKind.TS,
  typescript: ts.ScriptKind.TS,
  mts: ts.ScriptKind.TS,
  cts: ts.ScriptKind.TS,
  tsx: ts.ScriptKind.TSX,
  js: ts.ScriptKind.JS,
  javascript: ts.ScriptKind.JS,
  mjs: ts.ScriptKind.JS,
  cjs: ts.ScriptKind.JS,
  jsx: ts.ScriptKind.JSX
};

/** The name the block is parsed under, for each kind of file: the extension tells the parser whether JSX is read. */
const FILE_NAMES: ReadonlyMap<ts.ScriptKind, string> = new Map([
  [ts.ScriptKind.TS, "/block.ts"],
  [ts.ScriptKind.TSX, "/block.tsx"],
  [ts.ScriptKind.JS, "/block.js"],
  [ts.ScriptKind.JSX, "/block.jsx"]
]);

/** The compiler's classifications that colour a piece by themselves; the others are placed or left plain. */
const CLASSIFICATION_ROLES: ReadonlyMap<ts.ClassificationType, CodeRole> = new Map([
  [ts.ClassificationType.keyword, "keyword"],
  [ts.ClassificationType.stringLiteral, "string"],
  [ts.ClassificationType.jsxAttributeStringLiteralValue, "string"],
  [ts.ClassificationType.numericLiteral, "number"],
  [ts.ClassificationType.bigintLiteral, "number"],
  [ts.ClassificationType.comment, "comment"],
  [ts.ClassificationType.className, "type"],
  [ts.ClassificationType.enumName, "type"],
  [ts.ClassificationType.interfaceName, "type"],
  [ts.ClassificationType.typeParameterName, "type"],
  [ts.ClassificationType.moduleName, "type"],
  [ts.ClassificationType.jsxOpenTagName, "tag"],
  [ts.ClassificationType.jsxCloseTagName, "tag"],
  [ts.ClassificationType.jsxSelfClosingTagName, "tag"],
  [ts.ClassificationType.jsxAttribute, "attribute"]
]);

/**
 * Whether a fence name is of the TypeScript family, coloured here.
 *
 * @param language - the fence name (`tsx`, `ts`, `js`), in any case.
 */
export const isTypeScriptLanguage = (language: string): boolean =>
  Object.hasOwn(SCRIPT_KINDS, language.toLowerCase());

/** The block being classified: the language service reads it through its host. */
const current = { fileName: "/block.tsx", text: "", version: 0 };

/** The language service, created on the first block. */
let service: ts.LanguageService | undefined;

/** The language service over the current block, in syntactic mode: it parses, never type-checks. */
const languageService = (): ts.LanguageService => {
  if (service !== undefined) return service;
  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => ({ jsx: ts.JsxEmit.Preserve, allowJs: true }),
    getScriptFileNames: () => [current.fileName],
    getScriptVersion: () => String(current.version),
    getScriptSnapshot: (fileName: string): ts.IScriptSnapshot | undefined =>
      fileName === current.fileName ? ts.ScriptSnapshot.fromString(current.text) : undefined,
    getCurrentDirectory: () => "/",
    getDefaultLibFileName: () => "/lib.d.ts",
    readFile: () => undefined,
    fileExists: (fileName: string): boolean => fileName === current.fileName
  };
  service = ts.createLanguageService(host, undefined, ts.LanguageServiceMode.Syntactic);
  return service;
};

/**
 * The name a node writes in a type's place: a type reference, a type alias, a heritage clause, the class of a `new`,
 * a name imported as a type.
 *
 * @param node - any node of the block.
 */
const typeName = (node: ts.Node): ts.Node | undefined => {
  if (ts.isTypeReferenceNode(node)) return node.typeName;
  if (ts.isTypeAliasDeclaration(node)) return node.name;
  if (ts.isExpressionWithTypeArguments(node) || ts.isNewExpression(node)) return node.expression;
  if (ts.isImportSpecifier(node) && (node.isTypeOnly || node.parent.parent.isTypeOnly)) return node.name;
  return undefined;
};

/**
 * The name a node calls or declares as a function: a call, a tagged template, a function or method, a variable
 * holding an arrow or a function expression.
 *
 * @param node - any node of the block.
 */
const functionName = (node: ts.Node): ts.Node | undefined => {
  if (ts.isCallExpression(node)) return node.expression;
  if (ts.isTaggedTemplateExpression(node)) return node.tag;
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) {
    return node.name;
  }
  if (!ts.isVariableDeclaration(node) || node.initializer === undefined) return undefined;
  const isFunction = ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer);
  return isFunction ? node.name : undefined;
};

/**
 * The name a node reads or declares as a property: a member read, a property of an object, a type or a class, an
 * accessor.
 *
 * @param node - any node of the block.
 */
const propertyName = (node: ts.Node): ts.Node | undefined => {
  if (ts.isPropertyAccessExpression(node)) return node.name;
  const isDeclaration =
    ts.isPropertyAssignment(node) ||
    ts.isPropertySignature(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node);
  return isDeclaration ? node.name : undefined;
};

/**
 * Where each name the classifications leave plain stands, by its start: a type, a function or a property.
 *
 * @remarks
 * The first role found wins, and a node is read before its children: a call places its member as a function
 * (`items.map(…)`) before the member read under it would place it as a property.
 *
 * @param sourceFile - the block, parsed with its parents set.
 */
const nameRoles = (sourceFile: ts.SourceFile): Map<number, CodeRole> => {
  const roles = new Map<number, CodeRole>();
  const mark = (node: ts.Node | undefined, role: CodeRole): void => {
    // a dotted name (`React.ReactNode`, `items.map`) takes the role on its last part
    if (node === undefined) return;
    if (ts.isPropertyAccessExpression(node)) mark(node.name, role);
    else if (ts.isQualifiedName(node)) mark(node.right, role);
    else if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
      const start = node.getStart(sourceFile);
      if (!roles.has(start)) roles.set(start, role);
    }
  };
  const visit = (node: ts.Node): void => {
    mark(typeName(node), "type");
    mark(functionName(node), "function");
    mark(propertyName(node), "property");
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return roles;
};

/**
 * Where the comment a comment span opens ends: a block comment after its closing `*` `/`, a line comment at its
 * line's end. The compiler splits a documentation comment into its tags and names (and gives one of its pieces
 * twice); the comment is coloured whole instead, as one piece, as it reads.
 *
 * @param code - the block.
 * @param start - where the span starts.
 * @param end - where the span ends: the answer for a span that does not open a comment.
 */
const commentEnd = (code: string, start: number, end: number): number => {
  if (code.startsWith("/*", start)) {
    const close = code.indexOf("*/", start + 2);
    return close === -1 ? code.length : close + 2;
  }
  if (!code.startsWith("//", start)) return end;
  const lineEnd = code.slice(start).search(/[\r\n]/);
  return lineEnd === -1 ? code.length : start + lineEnd;
};

/**
 * A block of the TypeScript family as pieces, in order, covering it whole.
 *
 * @param code - the block.
 * @param language - its fence name (`tsx`, `ts`, `js`, `jsx`…); one outside the family is read as TSX.
 */
export const typeScriptPieces = (code: string, language: string): CodePiece[] => {
  const scriptKind = SCRIPT_KINDS[language.toLowerCase()] ?? ts.ScriptKind.TSX;
  current.fileName = FILE_NAMES.get(scriptKind) ?? "/block.tsx";
  current.text = code;
  current.version += 1;
  const { spans } = languageService().getEncodedSyntacticClassifications(current.fileName, {
    start: 0,
    length: code.length
  });
  const roles = nameRoles(
    ts.createSourceFile(current.fileName, code, ts.ScriptTarget.Latest, true, scriptKind)
  );
  const pieces: CodePiece[] = [];
  let cursor = 0;
  const push = (end: number, role?: CodeRole): void => {
    if (end <= cursor) return;
    const text = code.slice(cursor, end);
    pieces.push(role === undefined ? { text } : { text, role });
    cursor = end;
  };
  // the spans come as triples: start, length, classification
  for (let index = 0; index + 2 < spans.length; index += 3) {
    const start = spans[index] ?? 0;
    const end = start + (spans[index + 1] ?? 0);
    const classification: ts.ClassificationType = spans[index + 2] ?? ts.ClassificationType.text;
    // a span inside a piece already written (a comment taken whole) is part of it
    if (start < cursor) continue;
    push(start);
    if (classification === ts.ClassificationType.comment) push(commentEnd(code, start, end), "comment");
    else if (classification === ts.ClassificationType.identifier) push(end, roles.get(start));
    else push(end, CLASSIFICATION_ROLES.get(classification));
  }
  push(code.length);
  return pieces;
};
