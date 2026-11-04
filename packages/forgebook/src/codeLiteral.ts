/**
 * Values written into generated code: a Vite module the plugin or an adapter generates, a `define` value, the code a
 * transform inserts, or a script set inline in a page. Exported as `forgebook/code-literal`, so every adapter writes
 * them the same way.
 *
 * @remarks
 * `JSON.stringify` alone writes a valid JavaScript literal, but not one safe everywhere code goes: inside an inline
 * `<script>`, a string holding `</script>` or `<!--` ends or changes the script, and before ES2019 a raw U+2028 or
 * U+2029 ended a string literal. The literal written here escapes `<`, `>` and `/` and both separators, so it reads
 * back as the same value in a module, in an inline script and in an older parser alike, wherever a generator places
 * it. The escapes only ever fall inside string literals: JSON writes those characters nowhere else. Each is a pass
 * of its own, a native replacement as fast on a large document as one pass with a callback, and the form code
 * scanners read as escaping.
 *
 * Imports nothing, so the shell (an embed's code), the plugin on Node and the adapters can all use it.
 *
 * @module
 */

/**
 * JSON text as code: the same value, with `<`, `>`, `/`, U+2028 and U+2029 escaped. For JSON a caller already holds
 * (a document also written to a file); otherwise `codeLiteral`. Only for JSON text: JSON writes those characters
 * nowhere but inside strings, where their escapes read the same, while in other code (`a / b`, `x < y`) they would
 * change it.
 *
 * @param json - the JSON text, as `JSON.stringify` writes it.
 * @returns the text as a JavaScript expression of the same value.
 */
export const codeOfJson = (json: string): string =>
  json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\//g, "\\/")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

/**
 * A value as a JavaScript literal for generated code: `JSON.stringify` with the characters that could end a script
 * or a string escaped (`codeOfJson`).
 *
 * @param value - a value JSON can write: a string, number, boolean, null, or an array or object of them.
 * @returns the literal, which evaluates to an equal value.
 * @throws `TypeError` when JSON writes nothing for the value (`undefined`, a function, a symbol), which would leave a
 *   hole in the code, and for a `bigint`, which JSON cannot write. As in JSON, a key whose value is `undefined` is left
 *   out and `NaN` is written `null`.
 */
export const codeLiteral = (value: unknown): string => {
  const json: unknown = JSON.stringify(value);
  if (typeof json !== "string") throw new TypeError(`A ${typeof value} has no literal in generated code`);
  return codeOfJson(json);
};
