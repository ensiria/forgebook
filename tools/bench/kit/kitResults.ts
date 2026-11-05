/**
 * The bench kit's results file: what goes in it, with nothing that names the person or the computer.
 *
 * @remarks
 * The reports and the logs are measurements, but a failure's message quotes a command line, and a command line holds
 * paths under the user's folder, so the user's name. Every text is rewritten before it is archived: the home folder
 * becomes `~`, the user's name and the computer's name become placeholders, in every spelling a path takes (both
 * separators, and the doubled backslash of a JSON string). Any user's folder is cut the same way whatever spells it
 * (Windows' short `MARIOR~1`, another account), and a OneDrive folder's name, which names an employer, becomes a
 * placeholder. Then each text is searched again, and anything left is a leak the kit refuses to archive. Pure.
 *
 * @module
 */

/** What names the person and the computer. */
export type Identity = {
  /** The user's home folder. */
  readonly home: string;
  /** The user's login name. */
  readonly user: string;
  /** The computer's name. */
  readonly host: string;
};

/** The placeholder of the user's name. */
export const USER_PLACEHOLDER = "<user>";

/** The placeholder of the computer's name. */
export const HOST_PLACEHOLDER = "<computer>";

/** Shorter names are not replaced as words: a two-letter name would rewrite measurements' text at random. */
const MIN_NAME_LENGTH = 3;

/** A text as a regular expression matching it literally. */
const literal = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every spelling a path takes in a text: as written, with `/`, with `\`, and with JSON's doubled `\`. */
const spellings = (path: string): string[] => {
  const forward = path.replaceAll("\\", "/");
  const back = forward.replaceAll("/", "\\");
  return [...new Set([path, forward, back, back.replaceAll("\\", "\\\\")])].sort(
    (a, b) => b.length - a.length
  );
};

/**
 * A user's folder in any spelling: a Windows profile (`C:\Users\<name>`, a separator doubled in JSON, the short
 * `MARIOR~1` form included), a Linux home, a macOS one. Its owner's name is the segment after `Users` or `home`.
 */
const USER_FOLDER =
  /(?:\b[A-Za-z]:(?:\\{1,2}|\/)Users(?:\\{1,2}|\/)|(?<![\w.~-])\/(?:Users|home)\/)(?!~)[^\\/"'\s:]+/gi;

/** A OneDrive folder's name: `OneDrive - <organisation>`, up to the next separator or quote. */
const ONEDRIVE = /OneDrive - [^\\/"'\n]+/g;

/** The placeholder of a OneDrive folder's organisation. */
export const ORGANISATION_PLACEHOLDER = "OneDrive - <organisation>";

/** A name as a whole word, whatever its case: `<user>` must not eat part of `username`. */
const word = (name: string): RegExp => new RegExp(`(?<![\\w-])${literal(name)}(?![\\w-])`, "gi");

/**
 * A text with the person and the computer taken out.
 *
 * @param text - the text.
 * @param identity - what names them.
 */
export const anonymize = (text: string, identity: Identity): string => {
  let result = text;
  if (identity.home.length >= MIN_NAME_LENGTH) {
    for (const spelling of spellings(identity.home))
      result = result.replace(new RegExp(literal(spelling), "gi"), "~");
  }
  if (identity.user.length >= MIN_NAME_LENGTH) result = result.replace(word(identity.user), USER_PLACEHOLDER);
  if (identity.host.length >= MIN_NAME_LENGTH) result = result.replace(word(identity.host), HOST_PLACEHOLDER);
  return result.replace(USER_FOLDER, "~").replace(ONEDRIVE, ORGANISATION_PLACEHOLDER);
};

/**
 * What of the identity is still in a text: empty once `anonymize` did its work.
 *
 * @param text - the text.
 * @param identity - what names the person and the computer.
 * @returns the kinds found: `home`, `user`, `computer`, `user folder`, `OneDrive`.
 */
export const leaks = (text: string, identity: Identity): string[] => {
  // the placeholders are no leak, though a user named User finds its name in them
  const named = text.replaceAll(USER_PLACEHOLDER, "").replaceAll(HOST_PLACEHOLDER, "");
  return [
    ...(new RegExp(USER_FOLDER.source, "i").test(text) ? ["user folder"] : []),
    ...(text.replaceAll(ORGANISATION_PLACEHOLDER, "").includes("OneDrive - ") ? ["OneDrive"] : []),
    ...(identity.home.length >= MIN_NAME_LENGTH &&
    spellings(identity.home).some((spelling) => text.toLowerCase().includes(spelling.toLowerCase()))
      ? ["home"]
      : []),
    ...(identity.user.length >= MIN_NAME_LENGTH && word(identity.user).test(named) ? ["user"] : []),
    ...(identity.host.length >= MIN_NAME_LENGTH && word(identity.host).test(named) ? ["computer"] : [])
  ];
};

/**
 * The note at the top of the archive, in Italian, for whoever opens it.
 *
 * @param files - the archive's other files.
 */
export const readme = (files: readonly string[]): string =>
  [
    "Risultati del benchmark di Forgebook",
    "",
    "Contenuto:",
    "- reports/: i risultati delle misure (tempi, memoria, dimensioni) e, per ogni gruppo di misure, lo stato del PC",
    "  (alimentazione, carico del processore, antivirus e indicizzazione).",
    "- kit.json: il profilo scelto, la stima e la durata reale di ogni parte, la descrizione del PC (sistema,",
    "  processore, memoria, versione di Node).",
    "- logs/: quello che il benchmark ha scritto durante la corsa, per capire un errore.",
    "",
    "Non contiene nome utente, nome del computer, file personali o indirizzi di rete: i percorsi sono stati resi",
    `anonimi (~ per la cartella dell'utente, ${USER_PLACEHOLDER} e ${HOST_PLACEHOLDER} per i nomi).`,
    "",
    "File:",
    ...files.map((file) => `- ${file}`),
    ""
  ].join("\n");
