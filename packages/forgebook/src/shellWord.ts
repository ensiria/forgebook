/**
 * A file's name as one word of a command an agent will run: a name comes from a branch that may not be trusted, and
 * `$(…)` in it must stay text. Shared by what `verify` and `visibility` tell an agent to run.
 *
 * @module
 */

/**
 * The word.
 *
 * @param path - the file's name.
 */
export const shellWord = (path: string): string => {
  const named = path.startsWith("-") ? `./${path}` : path;
  return /^[\w./@+-]+$/.test(named) ? named : `'${named.replaceAll("'", `'\\''`)}'`;
};
