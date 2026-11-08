/**
 * What a file's text imports and what it exports under another name, read with patterns and no parser: the audit's story
 * coverage (`storyCoverage.ts`) reads every file of a project, single-file components among them, in a moment.
 *
 * @remarks
 * Every pattern is bounded and never matches the same characters two ways, since a project's files can be crafted: a run of
 * spaces taken both by a `\s+` and by the clause after it would make one file take seconds.
 *
 * @module
 */

/** One name an import takes: its name in the module (`default`, `*` for all of it) and in the file. */
export type ImportedName = {
  /** Its name in the module: `default`, `*` for the whole module, or an export's name. */
  readonly imported: string;
  /** Its name in the importing file; empty when it has none (`import("./x")`). */
  readonly local: string;
};

/** What a file imports from one module. */
export type FileImport = {
  /** The module, as written. */
  readonly specifier: string;
  /** The names taken from it. */
  readonly names: readonly ImportedName[];
};

/**
 * An import of values: `import A, { B as C } from "x"`; types only are left out. `import` and its first space are taken
 * once, and the clause takes everything up to one space before `from`, comments in braces too, but never another
 * `import`: an `import` with no `from` would otherwise be read again from every later one.
 */
const STATIC_IMPORT =
  /\bimport\s(?!\s*type\s)((?:(?!\bimport\b)[^"';]){1,2000}?)\sfrom\s*["']([^"'\n]{1,500})["']/g;

/** A dynamic import, which takes the whole module. */
const DYNAMIC_IMPORT = /\bimport\(\s*["']([^"'\n]{1,500})["']\s*\)/g;

/** A `require`; what it is given to is read backwards from it, so no pattern is tried at every character before one. */
const REQUIRE = /\brequire\(\s*["']([^"'\n]{1,500})["']\s*\)/g;

/** How far back from a `require` its binding is looked for. */
const MOST_BACK = 2000;

/** An export of local names, without `from`: `export { Root as Dialog }`. */
const LOCAL_EXPORT = /\bexport\s{0,20}\{([^{}]{0,2000})\}(?!\s{0,20}from\b)/g;

/** Comments, which an import's braces may hold. */
const COMMENT = /\/\*[\s\S]{0,2000}?\*\/|\/\/[^\n]{0,2000}/g;

/** The names a list in braces takes: `A, B as C, type D`, with `separator` between a name and its new one. */
const bracedNames = (list: string, separator: RegExp): ImportedName[] =>
  list
    .replace(COMMENT, "")
    .split(",")
    .flatMap((part) => {
      const [imported, local] = part.trim().split(separator);
      if (imported === undefined || imported === "" || imported.startsWith("type ")) return [];
      return [{ imported: imported.trim(), local: (local ?? imported).trim() }];
    });

/** The names an import's clause takes. */
const clauseNames = (clause: string): ImportedName[] => {
  const braces = /\{([^}]*)\}/.exec(clause);
  const names = bracedNames(braces?.[1] ?? "", /\s+as\s+/);
  const rest = clause.replace(COMMENT, "").replace(/\{[^}]*\}/, "");
  const namespace = /\*\s*as\s+([\w$]+)/.exec(rest);
  if (namespace?.[1] !== undefined) names.push({ imported: "*", local: namespace[1] });
  const first = /^\s*([\w$]+)\s*(?:,|$)/.exec(rest);
  if (first?.[1] !== undefined) names.push({ imported: "default", local: first[1] });
  return names;
};

/** A member written after a name, `UI.Button`, starting only where a name starts so each is tried once. */
const MEMBER = /(?<![\w$.])([A-Za-z_$][\w$]{0,200})\.([A-Za-z_$][\w$]{0,200})/g;

/**
 * The members a file writes after each name: `UI.Button` and `<UI.Button>` list `Button` under `UI`. Read in one pass,
 * since a file can import many namespaces.
 *
 * @param text - the file's text.
 */
const membersByName = (text: string): ReadonlyMap<string, ReadonlySet<string>> => {
  const members = new Map<string, Set<string>>();
  for (const match of text.matchAll(MEMBER)) {
    const [, owner = "", member = ""] = match;
    members.set(owner, (members.get(owner) ?? new Set()).add(member));
  }
  return members;
};

/** An import with the members its namespaces are used for added: a barrel's namespace names what it takes. */
const withMembers = (
  found: FileImport,
  members: () => ReadonlyMap<string, ReadonlySet<string>>
): FileImport => ({
  ...found,
  names: found.names.flatMap((name) =>
    name.imported === "*" && name.local !== ""
      ? [
          name,
          ...[...(members().get(name.local) ?? [])].map((member) => ({ imported: member, local: member }))
        ]
      : [name]
  )
});

/** A character a name is written with. */
const NAME_CHARACTER = /[\w$]/;

/** The name a text ends with, read backwards so a long text costs only its name; empty when it ends otherwise. */
const trailingName = (text: string): string => {
  let start = text.length;
  while (start > 0 && text.length - start < 200 && NAME_CHARACTER.test(text.charAt(start - 1))) start -= 1;
  return text.slice(start);
};

/**
 * What a `require` takes, from the text before it: `const { A, B: C } =` takes names, `const x =` the whole module as
 * `x`, and nothing the whole module unnamed.
 *
 * @param before - the text just before `require`.
 */
const requiredNames = (before: string): ImportedName[] => {
  const head = before.trimEnd();
  if (!head.endsWith("=")) return [{ imported: "*", local: "" }];
  const target = head.slice(0, -1).trimEnd();
  if (target.endsWith("}")) {
    const open = target.lastIndexOf("{");
    if (open !== -1) return bracedNames(target.slice(open + 1, -1), /\s*:\s*/);
  }
  return [{ imported: "*", local: trailingName(target) }];
};

/**
 * What a file's text imports: static and dynamic imports and `require`, with the members a namespace is used for.
 *
 * @param text - the file's text.
 */
export const importsOf = (text: string): FileImport[] => {
  let read: ReadonlyMap<string, ReadonlySet<string>> | undefined;
  const members = (): ReadonlyMap<string, ReadonlySet<string>> => {
    read ??= membersByName(text);
    return read;
  };
  return [
    ...[...text.matchAll(STATIC_IMPORT)].map((match) => ({
      specifier: match[2] ?? "",
      names: clauseNames(match[1] ?? "")
    })),
    ...[...text.matchAll(DYNAMIC_IMPORT)].map((match) => ({
      specifier: match[1] ?? "",
      names: [{ imported: "*", local: "" }]
    })),
    ...[...text.matchAll(REQUIRE)].map((match) => ({
      specifier: match[1] ?? "",
      names: requiredNames(text.slice(Math.max(0, match.index - MOST_BACK), match.index))
    }))
  ].map((found) => withMembers(found, members));
};

/**
 * The names a file exports its own declarations under, when they differ: `export { Root as Dialog }` maps `Dialog` to
 * `Root`.
 *
 * @param text - the file's text.
 */
export const exportAliasesOf = (text: string): ReadonlyMap<string, string> =>
  new Map(
    [...text.matchAll(LOCAL_EXPORT)]
      .flatMap((match) => bracedNames(match[1] ?? "", /\s+as\s+/))
      .filter(({ imported, local }) => imported !== local)
      .map(({ imported, local }) => [local, imported])
  );
