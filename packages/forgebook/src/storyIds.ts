/**
 * Story and component ids as Storybook writes them, so an address, a link or a picture's name carries over from a
 * Storybook catalogue unchanged.
 *
 * @remarks
 * Storybook's id is its CSF rule: the meta's `id` (else its title) and the story's name made from its export, each
 * lower-cased with every punctuation mark and space turned into one `-`, joined by `--`. The export's name is first
 * split into words at its case changes, digits, `_`, `-` and `.` (`HTMLButton2X` → `HTML Button 2 X`); the title is
 * not, so `Inputs/ReadMore` is `inputs-readmore`. The words also name a story that writes no name (`storyName`). Letters outside ASCII are kept, as Storybook keeps them. Pure, and
 * small: the shell and every frame carry it.
 *
 * @module
 */

/** The characters Storybook's ids turn into `-`: spaces and punctuation, never letters or digits of any script. */
const ID_PUNCTUATION = /[ ’–—―′¿'`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/g;

/**
 * A text as an id's part, as Storybook's `sanitize`: lower case, each run of spaces and punctuation one `-`, none at
 * either end.
 *
 * @param text - a title, a meta's `id` or a story's name.
 * @returns the part; empty when the text has no letter or digit.
 */
export const idPart = (text: string): string =>
  text.toLowerCase().replace(ID_PUNCTUATION, "-").replace(/-+/g, "-").replace(/^-+/, "").replace(/-+$/, "");

/**
 * The words of an export's name, as Storybook splits it to name a story: at `_`, `-`, `.`, at case changes and around
 * digits, each word as written (`KeyboardOpen` → `Keyboard`, `Open`; `CustomSVGIcon` → `Custom`, `SVG`, `Icon`;
 * `Size2X` → `Size`, `2`, `X`).
 *
 * @param exportName - the named export.
 */
export const exportWords = (exportName: string): string[] =>
  exportName
    .replace(/[_\-.]/g, " ")
    .replace(/([^\n])([A-Z])([a-z])/g, "$1 $2$3")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-z])([0-9])/gi, "$1 $2")
    .replace(/([0-9])([a-z])/gi, "$1 $2")
    .split(" ")
    .filter((word) => word !== "");

/**
 * A story's id as Storybook writes it, without a source: the component's part and the story's, joined by `--`.
 *
 * @param component - the meta's `id` when it writes one, else the title.
 * @param exportName - the story's export.
 */
export const csfStoryId = (component: string, exportName: string): string =>
  `${idPart(component)}--${idPart(exportWords(exportName).join(" "))}`;
