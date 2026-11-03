/**
 * The code of a component whose stories come from several files, as one loader: the Code cards of its page read each
 * story's code by its export, whichever file it is in.
 *
 * @remarks
 * The loader of a component in one file is the source's own, unchanged. One in several files is made once per list of
 * files and kept, since the page loads the code again whenever its loader changes.
 *
 * @module
 */

/** A source's loaders of its files' code, by file. */
type CodeLoaders = Readonly<Record<string, () => Promise<unknown>>>;

/** The loaders made so far, by the source's loaders, then by the files joined. */
const MADE = new WeakMap<CodeLoaders, Map<string, () => Promise<unknown>>>();

/**
 * One loader for the code of several files: each file's code, a story's export found in the first file that has it.
 *
 * @param loaders - the source's loaders of its files' code.
 * @param files - the component's files, its first file first.
 * @returns the loader; `undefined` when no file has one.
 */
export const filesCodeLoader = (
  loaders: CodeLoaders,
  files: readonly string[]
): (() => Promise<unknown>) | undefined => {
  const own = files.flatMap((file) => {
    const load = loaders[file];
    return load === undefined ? [] : [load];
  });
  if (own.length <= 1) return own[0];
  const made = MADE.get(loaders) ?? new Map<string, () => Promise<unknown>>();
  MADE.set(loaders, made);
  const key = files.join("\n");
  const known = made.get(key);
  if (known !== undefined) return known;
  // the last file is assigned first, so a story of an earlier file wins; an `error` of any file stays and is shown
  const load = (): Promise<unknown> =>
    Promise.all(own.map((each) => each())).then((codes) => Object.assign({}, ...codes.reverse()));
  made.set(key, load);
  return load;
};
