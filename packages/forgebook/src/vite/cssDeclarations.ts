/**
 * The custom properties a style sheet declares, with where each stands, and the statements that lead to other sheets.
 *
 * @remarks
 * Pure, and a scanner of its own rather than a CSS parser: the sheets that hold a project's system are as often Sass or
 * Less as CSS, and they hold at-rules a CSS parser refuses (`@theme`, `@apply`, `@mixin`). All this needs is the nesting
 * and the declarations, which every one of those languages writes alike. A value is kept as written: what it comes to
 * depends on every other sheet, so `cssTokenValues.ts` works it out once all are read.
 *
 * @module
 */

/** Where a declaration stands, as far as a design system goes. */
export type CssPlace =
  /** On the document (`:root`, `html`, `:host`), so anything can read it. */
  | { readonly kind: "root" }
  /** In Tailwind's `@theme`, which makes utilities of it. */
  | { readonly kind: "theme" }
  /** Applied by a theme (`.dark`, `[data-theme="x"]`, a colour-scheme query). */
  | { readonly kind: "mode"; readonly mode: string }
  /**
   * On one selector, which may be a component's own variables or a system's root: how many it holds tells. A theme may
   * apply over it (`.app.dark`, `.app { &.dark { … } }`).
   */
  | { readonly kind: "selector"; readonly selector: string; readonly mode?: string }
  /** Inside something that applies only sometimes (a width query, an animation): not a token's value. */
  | { readonly kind: "conditional" };

/** A custom property a sheet declares. */
export type CssDeclaration = {
  /** Its name, with its dashes. */
  readonly name: string;
  /** Its value, as written. */
  readonly value: string;
  /** Its line, from 1. */
  readonly line: number;
  /** Where it stands. */
  readonly place: CssPlace;
};

/** What a sheet holds. */
export type CssReading = {
  /** Its custom properties, in order. */
  readonly declarations: readonly CssDeclaration[];
  /** What its `@import`s name, as written. */
  readonly imports: readonly string[];
  /** What its `@config`s name, as written: Tailwind's configuration files. */
  readonly configs: readonly string[];
  /** What its `@plugin`s name: their tokens cannot be known without running them. */
  readonly plugins: readonly string[];
  /** Whether it brings in Tailwind's default theme. */
  readonly importsTailwindTheme: boolean;
  /** Whether it uses Tailwind's older directives, which mean a configuration file and not `@theme`. */
  readonly usesTailwindDirectives: boolean;
};

/** A class or an attribute's value that names the dark or the light theme, not one that only ends like it (`btn-light`). */
const MODE_NAME = /^(?:[\w-]*(?:theme|mode)[-_]+)?(dark|light)(?:[-_]+(?:mode|theme))?$/i;

/** A theme named in a class or an attribute. */
const NAMED_THEME = /(?:\.theme[-_]+|\[data-(?:theme|mode|color-mode|color-scheme)[~|^$*]?=["']?)([\w-]+)/i;

/** A class or an attribute in a selector. */
const SIMPLE_SELECTOR = /\.[\w-]+|\[[^\]]+\]/g;

/** The way a theme goes without a class. */
const COLOR_SCHEME_QUERY = /prefers-color-scheme:\s*(dark|light)/i;

/** A `@variant` naming a theme, inside a selector or `@theme`. */
const VARIANT_RULE = /^@variant\s+(dark|light)\b/i;

/** At-rules whose contents hold in every case. */
const TRANSPARENT_RULE = /^@(?:layer|supports|container\s+style)\b/;

/** What Tailwind's `@import` names. */
const TAILWIND_THEME_IMPORT = /^(?:tailwindcss|tailwindcss\/theme(?:\.css)?)$/;

/** The older directives. */
const TAILWIND_DIRECTIVE = /^@tailwind\s+(?:base|components|utilities)\b/;

/** A quoted or `url()` path after an at-rule's name. */
const QUOTED_PATH = /^@[\w-]+\s+(?:\([^)]*\)\s*)?(?:url\(\s*)?["']?([^"')\s;,]+)/;

/** A selector list's parts, not splitting inside parentheses or brackets. */
const selectorParts = (selector: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of selector) {
    if (character === "(" || character === "[") depth += 1;
    if (character === ")" || character === "]") depth -= 1;
    if (character === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else current += character;
  }
  parts.push(current.trim());
  return parts.filter((part) => part !== "");
};

/** A selector with `:is()` and `:where()` taken off and what stands for the document or the parent dropped. */
const plainPart = (part: string): string =>
  part
    .replace(/:(?:is|where)\(([^()]*)\)/g, "$1")
    .replace(/^(?:&|:root|html|body|:host)(?=[.[:]|$)/, "")
    .trim();

/** The theme a `:not()` means: the opposite of the one it leaves out. */
const modeOfNot = (part: string): string | undefined => {
  const left = /:not\(([^()]*)\)/.exec(part)?.[1];
  const word = left === undefined ? undefined : MODE_NAME.exec(left.replace(/^[.[]/, ""))?.[1]?.toLowerCase();
  if (word === undefined) return undefined;
  return word === "dark" ? "light" : "dark";
};

/** The theme a class or an attribute names. */
const modeOfName = (name: string): string | undefined =>
  (MODE_NAME.exec(name)?.[1] ?? NAMED_THEME.exec(`.${name}`)?.[1])?.toLowerCase();

/** What one selector says: `.dark .card` is that card's variables in a theme, so a descendant names no theme. */
const partMeaning = (written: string): { mode?: string; selector?: string; isRoot?: boolean } => {
  const part = plainPart(written);
  if (part === "") return { isRoot: true };
  if (/\s|>|~|\+/.test(part)) return { selector: written };
  const not = modeOfNot(part);
  if (not !== undefined) return { mode: not };
  const simple = [...part.matchAll(SIMPLE_SELECTOR)].map((match) => match[0]);
  const named = simple.map((each) => {
    const attribute = NAMED_THEME.exec(each)?.[1] ?? /=["']?([\w-]+)/.exec(each)?.[1];
    return attribute === undefined ? modeOfName(each.slice(1)) : attribute.toLowerCase();
  });
  const mode = named.find((each) => each !== undefined);
  if (mode === undefined) return { selector: written };
  const others = simple.filter((_, index) => named[index] === undefined);
  return others.length === 0 ? { mode } : { mode, selector: others.join("") };
};

/** What one block says of what is inside it. */
type BlockMeaning = {
  /** The theme it applies, when it applies one. */
  readonly mode?: string;
  /** It is Tailwind's `@theme`. */
  readonly isTheme?: true;
  /** It is one selector that is neither the document nor a theme. */
  readonly selector?: string;
  /** What is inside holds only sometimes. */
  readonly isConditional?: true;
};

/** What one block says, from its text. */
const meaningOf = (block: string): BlockMeaning => {
  const themed = COLOR_SCHEME_QUERY.exec(block)?.[1] ?? VARIANT_RULE.exec(block)?.[1];
  if (themed !== undefined) return { mode: themed.toLowerCase() };
  if (block.startsWith("@theme")) return { isTheme: true };
  if (TRANSPARENT_RULE.test(block)) return {};
  if (block.startsWith("@")) return { isConditional: true };
  const parts = selectorParts(block).map(partMeaning);
  // `:root, .light` is the base written out, which a theme overrides
  if (parts.some((part) => part.isRoot === true)) return {};
  const mode = parts.find((part) => part.mode !== undefined)?.mode;
  const selector = parts.some((part) => part.mode === undefined) ? block : parts[0]?.selector;
  return { ...(mode === undefined ? {} : { mode }), ...(selector === undefined ? {} : { selector }) };
};

/** Where a declaration stands, under what the blocks it is inside mean, outermost first. */
const placeOf = (meanings: readonly BlockMeaning[]): CssPlace => {
  if (meanings.some((each) => each.isConditional === true)) return { kind: "conditional" };
  const mode = meanings.findLast((each) => each.mode !== undefined)?.mode;
  const selector = meanings.find((each) => each.selector !== undefined)?.selector;
  if (selector !== undefined) {
    return { kind: "selector", selector, ...(mode === undefined ? {} : { mode }) };
  }
  if (mode !== undefined) return { kind: "mode", mode };
  return meanings.some((each) => each.isTheme === true) ? { kind: "theme" } : { kind: "root" };
};

/** Where a quote's text ends, past its closing quote. */
const afterString = (text: string, start: number): number => {
  const quote = text[start];
  for (let index: number = start + 1; index < text.length; index += 1) {
    if (text[index] === "\\") index += 1;
    else if (text[index] === quote || text[index] === "\n") return index + 1;
  }
  return text.length;
};

/** Where a brace opened at a position closes, past it. */
const afterBlock = (text: string, start: number): number => {
  let depth = 0;
  for (let index: number = start; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    if (text[index] === "}") depth -= 1;
    if (depth === 0) return index + 1;
  }
  return text.length;
};

/** Where a comment starting at a position ends, or the position when none starts there. */
const afterComment = (text: string, index: number): number => {
  if (text.startsWith("/*", index)) {
    const end = text.indexOf("*/", index + 2);
    return end === -1 ? text.length : end + 2;
  }
  // a line comment in Sass and Less, also inside a map's parentheses; after a colon or `url(` it is an address
  const isLineComment = text.startsWith("//", index) && text[index - 1] !== ":" && text[index - 1] !== "(";
  return isLineComment ? text.indexOf("\n", index) + 1 || text.length : index;
};

/** How far into parentheses a character leaves a run of text. */
const parenthesesAfter = (character: string | undefined, depth: number): number => {
  if (character === "(") return depth + 1;
  return character === ")" ? Math.max(0, depth - 1) : depth;
};

/** A sheet with its comments blanked and every newline kept, so an offset still gives a line. */
const withoutComments = (text: string): string => {
  let out = "";
  let index = 0;
  while (index < text.length) {
    const end = afterComment(text, index);
    if (end !== index) {
      out += text.slice(index, end).replace(/[^\n]/g, " ");
      index = end;
    } else if (text[index] === '"' || text[index] === "'") {
      const close = afterString(text, index);
      out += text.slice(index, close);
      index = close;
    } else {
      out += text[index];
      index += 1;
    }
  }
  return out;
};

/** What the scanner finds, in order. */
type SheetPart =
  | { readonly kind: "open"; readonly prelude: string }
  | { readonly kind: "close" }
  | { readonly kind: "statement"; readonly text: string; readonly start: number };

/** Where a run of text a brace must not end (a string, Sass's `#{…}`, a custom property's block) ends, or the start. */
const afterOpaque = (text: string, index: number, statement: string): number => {
  const character = text[index];
  if (character === '"' || character === "'") return afterString(text, index);
  if (character === "#" && text[index + 1] === "{") return afterBlock(text, index + 1);
  return character === "{" && statement.trimStart().startsWith("--") ? afterBlock(text, index) : index;
};

/** A sheet with no comments as its blocks and statements. */
const sheetParts = (text: string): SheetPart[] => {
  const parts: SheetPart[] = [];
  let statement = "";
  let start = 0;
  let depth = 0;
  const finish = (): void => {
    if (statement.trim() !== "") parts.push({ kind: "statement", text: statement.trim(), start });
    statement = "";
  };
  const structure = (character: string): void => {
    if (character === "{") {
      parts.push({ kind: "open", prelude: statement.trim().replace(/\s+/g, " ") });
      statement = "";
      return;
    }
    finish();
    if (character === "}") parts.push({ kind: "close" });
  };
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? "";
    const end = afterOpaque(text, index, statement);
    if (statement === "") start = index;
    if (end !== index) {
      statement += text.slice(index, end);
      index = end - 1;
    } else if (depth === 0 && "{};".includes(character)) {
      structure(character);
    } else {
      depth = parenthesesAfter(character, depth);
      // what comes before a statement is not part of it, and its first character gives its line
      if (statement !== "" || !/\s/.test(character)) statement += character;
    }
  }
  finish();
  return parts;
};

/** The value of a declaration, with no `!important` and its spacing made plain. */
const declaredValue = (written: string): string => {
  const text = written.trim();
  const flag = "!important";
  const plain = text.endsWith(flag) ? text.slice(0, -flag.length) : text;
  return plain.split(/\s+/).join(" ").trim();
};

/** The path an at-rule of a name holds, when the statement is that rule. */
const pathOfRule = (written: string, rule: string): string[] => {
  if (!written.startsWith(rule)) return [];
  const path = QUOTED_PATH.exec(written)?.[1];
  return path === undefined ? [] : [path];
};

/**
 * Reads a sheet.
 *
 * @param text - the sheet's text: CSS, Sass or Less.
 */
export const readCssText = (text: string): CssReading => {
  const plain = withoutComments(text);
  const meanings: BlockMeaning[] = [];
  const statements: string[] = [];
  const declarations: CssDeclaration[] = [];
  let counted = 0;
  let line = 1;
  const lineAt = (offset: number): number => {
    for (; counted < offset; counted += 1) if (plain[counted] === "\n") line += 1;
    return line;
  };
  for (const part of sheetParts(plain)) {
    if (part.kind === "open") meanings.push(meaningOf(part.prelude));
    else if (part.kind === "close") meanings.pop();
    else if (part.text.startsWith("--") && part.text.indexOf(":") > 0) {
      const colon = part.text.indexOf(":");
      declarations.push({
        name: part.text.slice(0, colon).trim(),
        value: declaredValue(part.text.slice(colon + 1)),
        line: lineAt(part.start),
        place: placeOf(meanings)
      });
    } else statements.push(part.text);
  }
  const imports = statements.flatMap((each) =>
    ["@import", "@use", "@forward"].flatMap((rule) => pathOfRule(each, rule))
  );
  return {
    declarations,
    imports,
    configs: statements.flatMap((each) => pathOfRule(each, "@config")),
    plugins: statements.flatMap((each) => pathOfRule(each, "@plugin")),
    importsTailwindTheme: imports.some((path) => TAILWIND_THEME_IMPORT.test(path)),
    usesTailwindDirectives: statements.some((each) => TAILWIND_DIRECTIVE.test(each))
  };
};
