/**
 * The scripts of a Svelte component, read by Svelte's own parser: the one its opening comment and its `@module` sit in,
 * and the language it is written in.
 *
 * @module
 */
import { type AST, parse } from "svelte/compiler";

/**
 * A component's parsed file, or none when Svelte cannot read it.
 *
 * @param text - the file's text.
 */
const parsed = (text: string): AST.Root | undefined => {
  try {
    return parse(text, { modern: true });
  } catch {
    // a component being edited may not parse for a moment: it has no script to read until it does
    return undefined;
  }
};

/**
 * The scripts of a component, in the order the file writes them: `<script module>` and the instance's `<script>`.
 *
 * @param root - the parsed file.
 */
const scriptsOf = (root: AST.Root | undefined): AST.Script[] =>
  [root?.module, root?.instance]
    .filter((script) => script !== undefined && script !== null)
    .sort((left, right) => left.start - right.start);

/**
 * The first script of a component: a file with a `<script module>` and a `<script>` opens with either.
 *
 * @param text - the file's text.
 * @returns the script's text; empty when the file has none.
 */
export const scriptOf = (text: string): string => {
  const [first] = scriptsOf(parsed(text));
  if (first === undefined) return "";
  // Svelte's parser places the script's program in the file, which ESTree's type does not say
  const { content } = first;
  return "start" in content &&
    "end" in content &&
    typeof content.start === "number" &&
    typeof content.end === "number"
    ? text.slice(content.start, content.end)
    : "";
};

/** The value an attribute writes, as text; none for an expression or a bare attribute. */
const attributeText = (attribute: AST.Attribute): string | undefined => {
  const { value } = attribute;
  if (value === true || !Array.isArray(value)) return undefined;
  return value.map((part) => (part.type === "Text" ? part.data : "")).join("");
};

/**
 * Whether a component's scripts are TypeScript (`<script lang="ts">`).
 *
 * @param text - the file's text.
 */
export const isTypeScript = (text: string): boolean =>
  scriptsOf(parsed(text)).some((script) =>
    script.attributes.some(
      (attribute) => attribute.name === "lang" && /^(ts|typescript)$/.test(attributeText(attribute) ?? "")
    )
  );
