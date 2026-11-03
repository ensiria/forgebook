/**
 * The script of a single-file component, as TypeScript reads it: where its opening comment and its `@module` sit.
 *
 * @module
 */
import { parse } from "vue/compiler-sfc";

/**
 * The first script of a single-file component: a file with a `<script>` and a `<script setup>` opens with either.
 *
 * @param text - the file's text.
 * @returns the script's text; empty when the file has none.
 */
export const scriptOf = (text: string): string => {
  const { script, scriptSetup } = parse(text).descriptor;
  const [first] = [script, scriptSetup]
    .filter((block) => block !== null)
    .sort((left, right) => left.loc.start.offset - right.loc.start.offset);
  return first?.content ?? "";
};

/**
 * Every script of a single-file component, one after another: `defineEmits` sits in `<script setup>`, wherever that is.
 *
 * @param text - the file's text.
 */
export const scriptsOf = (text: string): string => {
  const { script, scriptSetup } = parse(text).descriptor;
  return [script?.content ?? "", scriptSetup?.content ?? ""].join("\n");
};
