/**
 * Code as coloured HTML, at build time: the code blocks of a component's documentation file and each story's
 * `render`, so the page shows them coloured without a highlighter in the browser.
 *
 * @remarks
 * The TypeScript family (TypeScript, TSX, JavaScript, JSX) is split by the TypeScript compiler
 * (`typeScriptPieces.ts`), and the other languages a component's documentation writes by short grammars
 * (`plainGrammars.ts`). Both give the same roles, written as the same classes, with the catalogue's prefix
 * (`forgebook-hl-keyword`), coloured by the shell's style sheet with its code palette. A language neither knows is escaped
 * and left plain.
 *
 * @module
 */
import { grammarPieces } from "./plainGrammars.ts";
import { type CodePiece, type CodeRole, isTypeScriptLanguage, typeScriptPieces } from "./typeScriptPieces.ts";

/** The class prefix of every coloured piece. */
export const HIGHLIGHT_PREFIX = "forgebook-hl-";

/** The characters HTML gives a meaning to, as entities. */
const ENTITIES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

/**
 * A text as HTML that shows it as written.
 *
 * @param text - the text.
 */
export const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (character) => ENTITIES[character] ?? character);

/** The classes of each role a piece can have. */
const ROLE_CLASSES: Readonly<Record<CodeRole, string>> = {
  keyword: `${HIGHLIGHT_PREFIX}keyword`,
  string: `${HIGHLIGHT_PREFIX}string`,
  number: `${HIGHLIGHT_PREFIX}number`,
  comment: `${HIGHLIGHT_PREFIX}comment`,
  type: `${HIGHLIGHT_PREFIX}type`,
  function: `${HIGHLIGHT_PREFIX}title function_`,
  property: `${HIGHLIGHT_PREFIX}property`,
  tag: `${HIGHLIGHT_PREFIX}name`,
  attribute: `${HIGHLIGHT_PREFIX}attr`
};

/**
 * A piece of code as HTML: escaped on its own, so a span never splits an entity.
 *
 * @param piece - the piece.
 */
const pieceHtml = ({ text, role }: CodePiece): string =>
  role === undefined ? escapeHtml(text) : `<span class="${ROLE_CLASSES[role]}">${escapeHtml(text)}</span>`;

/**
 * Code as HTML, coloured when its language is known.
 *
 * @param code - the code.
 * @param language - its language as a Markdown fence names it (`tsx`, `ts`, `scss`, `sh`); none leaves it plain.
 */
export const highlightCode = (code: string, language: string | undefined): string => {
  if (language === undefined) return escapeHtml(code);
  if (isTypeScriptLanguage(language)) return typeScriptPieces(code, language).map(pieceHtml).join("");
  const pieces = grammarPieces(code, language);
  return pieces === undefined ? escapeHtml(code) : pieces.map(pieceHtml).join("");
};
