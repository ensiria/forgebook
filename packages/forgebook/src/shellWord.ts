/**
 * A file's name as one word of a command an agent will run, shared by the answers that name a fix: a name comes from a
 * branch that may not be trusted, and `$(…)` in it must stay text.
 *
 * @module
 */

/**
 * The name, quoted for a POSIX shell when it holds anything but plain path characters.
 *
 * @param path - the file's name, as the command takes it.
 */
export const shellWord = (path: string): string => {
  const named = path.startsWith("-") ? `./${path}` : path;
  return /^[\w./@+-]+$/.test(named) ? named : `'${named.replaceAll("'", `'\\''`)}'`;
};
