/**
 * The names Nuxt gives a project's components from their files: `components/base/Button.vue` is `BaseButton`, and
 * `components/base/BaseButton.vue` is `BaseButton` too, the folder's part not repeated.
 *
 * @remarks
 * Pure: paths in, names out, as Nuxt's components module names them: the folders' names before the file's (unless
 * `pathPrefix: false`), the folder's `prefix` first, the words a file's name repeats from its folders dropped, an
 * `index` file named by its folder, `.client`, `.server` and `.global` left out of the name. Stories, tests,
 * declaration files and mixins in a components' folder are not components, as Nuxt ignores them.
 *
 * @module
 */

/** The extensions of a component. */
export const COMPONENT_EXTENSIONS = /\.(vue|tsx|jsx|ts|js|mjs)$/;

/** Files in a components' folder that are not components. */
const NOT_COMPONENTS = /\.(stories|story|test|spec)\.[^.]+$|\.d\.[cm]?ts$|(?:M|\.m|-m)ixin\.[jt]sx?$/;

/** A component's name and its file. */
export type ProjectComponent = {
  /** Its name (`BaseButton`). */
  readonly name: string;
  /** Its file, absolute. */
  readonly file: string;
  /**
   * The export it is, when not the file's default: a module may register a component its file exports by name (an
   * `index.ts` that exports `Button`, as shadcn-vue's do).
   */
  readonly exportName?: string;
};

/**
 * A name split into its words, at a dash, an underscore, a dot or a change of case (`baseButton` is `base`, `Button`).
 *
 * @param name - the name.
 */
export const wordsOf = (name: string): string[] =>
  name
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s\-_.]+/)
    .filter((word) => word !== "");

/**
 * Words joined as a component's name: each starting with a capital.
 *
 * @param words - the words.
 */
const pascalOf = (words: readonly string[]): string =>
  words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join("");

/**
 * The words of a component's name: its folders' words, the ones its file's name repeats at the end dropped, then the
 * file's.
 *
 * @param fileWords - the file name's words.
 * @param prefixWords - the folders' words, the prefix's first.
 */
const nameWords = (fileWords: readonly string[], prefixWords: readonly string[]): string[] => {
  const file = fileWords.map((word) => word.toLowerCase());
  // the longest end of the folders' words the file's name starts with is said once
  for (let start = 0; start < prefixWords.length; start += 1) {
    const end = prefixWords.slice(start).map((word) => word.toLowerCase());
    if (end.every((word, index) => file[index] === word))
      return [...prefixWords.slice(0, start), ...fileWords];
  }
  return [...prefixWords, ...fileWords];
};

/**
 * A component's name, from its path in its folder.
 *
 * @param file - its path from the folder, with `/` (`base/Button.vue`).
 * @param prefix - what every name of the folder starts with.
 * @param pathPrefix - whether its folders are part of its name.
 * @returns its name, or none for a file that is not a component.
 */
export const componentName = (file: string, prefix: string, pathPrefix: boolean): string | undefined => {
  if (!COMPONENT_EXTENSIONS.test(file) || NOT_COMPONENTS.test(file)) return undefined;
  const parts = file
    .replace(COMPONENT_EXTENSIONS, "")
    .replace(/\.(client|server|global|island)$/, "")
    .split("/");
  const base = parts.at(-1) ?? "";
  const folders = parts.slice(0, -1);
  // an `index` file is named by its folder, which the folders' words then say once
  const fileWords = wordsOf(base === "index" ? (folders.at(-1) ?? "") : base);
  const prefixWords = [...wordsOf(prefix), ...(pathPrefix ? folders.flatMap(wordsOf) : [])];
  const words = nameWords(fileWords, prefixWords);
  return words.length === 0 ? undefined : pascalOf(words);
};
