/**
 * The tokens two authors name with different values: a catalogue and a library it shows, or two libraries.
 *
 * @remarks
 * Pure, kept apart from reading the format. One author's files are layers and replace each other on purpose, so only a
 * change of author counts, and the same value from two authors is not a clash: a catalogue that still lists a library's
 * file, or two sources of one package, agree. Each theme is compared with itself: a catalogue giving a dark value to a
 * library's token that has none adds to it and replaces nothing.
 *
 * @module
 */

/** A name two authors give different values. */
export type TokenClash = {
  /** The token's name. */
  readonly name: string;
  /** The theme the values are in; none for the base. */
  readonly mode?: string;
  /** The file whose value stands, by what problems call it: the last one, so the catalogue's when it names the token. */
  readonly kept: string;
  /** The files it replaced. */
  readonly replaced: readonly string[];
};

/** A token as far as a clash reads it. */
type WrittenToken = {
  /** Its name. */
  readonly name: string;
  /** Its value, as the file writes it. */
  readonly value: unknown;
  /** Its file, by what problems call it. */
  readonly label: string;
  /** The source it comes from; none for the catalogue. */
  readonly source: string | undefined;
};

/** Every writing of one name in one theme. */
type Written = {
  readonly name: string;
  readonly mode: string | undefined;
  readonly tokens: WrittenToken[];
};

/** Each other author's last word on a name, when it differs from the value that stands. */
const replacedBy = (latest: WrittenToken, tokens: readonly WrittenToken[]): string[] => {
  const byAuthor = new Map(tokens.map((token) => [token.source, token]));
  const standing = JSON.stringify(latest.value);
  return [...byAuthor.values()]
    .filter((token) => token.source !== latest.source && JSON.stringify(token.value) !== standing)
    .map((token) => token.label);
};

/**
 * The clashes between files.
 *
 * @param files - each file's theme and tokens, in the order they are read.
 * @returns one clash per name and theme, in the files' order.
 */
export const tokenClashes = (
  files: readonly { readonly mode: string | undefined; readonly raw: readonly WrittenToken[] }[]
): TokenClash[] => {
  const written = new Map<string, Written>();
  for (const { mode, raw } of files) {
    for (const token of raw) {
      const key = JSON.stringify([mode ?? null, token.name]);
      const known = written.get(key);
      if (known === undefined) written.set(key, { name: token.name, mode, tokens: [token] });
      else known.tokens.push(token);
    }
  }
  return [...written.values()].flatMap(({ name, mode, tokens }): TokenClash[] => {
    const latest = tokens.at(-1);
    const replaced = latest === undefined ? [] : replacedBy(latest, tokens);
    if (latest === undefined || replaced.length === 0) return [];
    return [{ name, ...(mode === undefined ? {} : { mode }), kept: latest.label, replaced }];
  });
};
