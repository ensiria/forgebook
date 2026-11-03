/**
 * The modules of a SvelteKit project's environment, written for a catalogue: the public variables as SvelteKit gives
 * them to the browser, and a module that refuses to load for every one only a server may read.
 *
 * @remarks
 * SvelteKit 2 gives the variables whose name has the public prefix (`PUBLIC_`) through `$env/static/public` and
 * `$env/dynamic/public`; SvelteKit 3 the variables `src/env.ts` declares `public`, checked by their schema, through
 * `$app/env/public`. Nothing else of the environment reaches the page: `$env/static/private`, `$app/env/private` and
 * `$app/server` throw as they are loaded, so a component that reads a secret fails in its frame rather than shipping it.
 *
 * @module
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import { type Alias, runnerImport } from "vite";

/** The modules only a server may load, with what each is. */
export const SERVER_ONLY: Readonly<Record<string, string>> = {
  "$env/static/private": "the private environment",
  "$env/dynamic/private": "the private environment",
  "$app/env/private": "the private environment",
  "$app/server": "the server's own functions (getRequestEvent, read, the remote functions)",
  "$service-worker": "the service worker's own module"
};

/** The public environment modules, by the name a component imports. */
export const PUBLIC_ENV = ["$env/static/public", "$env/dynamic/public", "$app/env/public"] as const;

/** A public environment module's name. */
export type PublicEnvModule = (typeof PUBLIC_ENV)[number];

/** A name JavaScript takes as an export's. */
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** The words a `const` cannot be named, which a variable or an import may still be called. */
const RESERVED = new Set(
  "await break case catch class const continue debugger default delete do else enum export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield".split(
    " "
  )
);

/** The names `src/env` may have, in the order SvelteKit 3 looks for them. */
const ENV_FILES = ["env.ts", "env.js", "env.mts", "env.mjs"];

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A value written in a module: a text can hold `</script>` with no harm, since the module is not in the page's HTML.
 *
 * @param value - the value.
 */
const written = (value: unknown): string =>
  typeof value === "bigint" ? `${value}n` : (JSON.stringify(value) ?? "undefined");

/** The query a server-only import is rewritten with, naming what it imports (`?names=SECRET,TOKEN`). */
const NAMES_QUERY = "?names=";

/** An import of named exports: its names and its module. */
const NAMED_IMPORT = /import\s*(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s*from\s*(["'])([^"']+)\2/g;

/**
 * A module that refuses to load in a story: it declares the names its importer asked for, so the browser links it and
 * runs it, and its error, which says why, is the one the frame shows.
 *
 * @param id - the module's name, with the names it is imported with (`$app/env/private?names=TOKEN`).
 * @param reason - the error's message.
 */
export const refusedModule = (id: string, reason: string): string => {
  const [, names = ""] = id.split(NAMES_QUERY);
  const declared = names.split(",").filter((item) => IDENTIFIER.test(item) && !RESERVED.has(item));
  return [
    `throw new Error(${written(reason)});`,
    ...declared.map((item) => `export const ${item} = undefined;`),
    "export default undefined;",
    ""
  ].join("\n");
};

/**
 * A server-only module, refusing to load with why.
 *
 * @param id - the module's name, with the names it is imported with.
 */
export const serverOnlyModule = (id: string): string => {
  const name = kitModuleName(id) ?? id;
  return refusedModule(
    id,
    `${name} is ${SERVER_ONLY[name] ?? "server code"}, which only a server may load: a component drawn in a catalogue cannot import it. Give the story what it reads through its args or its page's data.`
  );
};

/**
 * A module's code with its named imports of SvelteKit's environment and server modules naming what they import, so a
 * module that refuses to load (`refusedModule`) can declare them.
 *
 * @param code - the module's code.
 * @returns the code, or none when it imports none of those modules by name.
 */
export const namedServerImports = (code: string): string | undefined => {
  let isChanged = false;
  const rewritten = code.replace(
    NAMED_IMPORT,
    (statement: string, list: string, quote: string, source: string) => {
      if (kitModuleName(source) === undefined) return statement;
      isChanged = true;
      const names = list
        .split(",")
        .map(
          (item) =>
            item
              .trim()
              .split(/\s+as\s+/)[0]
              ?.replace(/^type\s+/, "") ?? ""
        )
        .filter((item) => item !== "");
      return statement.replace(
        `${quote}${source}${quote}`,
        `${quote}${source}${NAMES_QUERY}${names.join(",")}${quote}`
      );
    }
  );
  return isChanged ? rewritten : undefined;
};

/**
 * The environment or server module of SvelteKit a name stands for, its query left out; none for another module.
 *
 * @param source - an import's module.
 */
export const kitModuleName = (source: string): string | undefined => {
  const [name = source] = source.split(NAMES_QUERY);
  return name in SERVER_ONLY || PUBLIC_ENV.some((known) => known === name) ? name : undefined;
};

/**
 * Whether a name is a server-only module, its query left out.
 *
 * @param source - an import's module.
 */
export const isServerOnly = (source: string): boolean => {
  const [name = source] = source.split(NAMES_QUERY);
  return name in SERVER_ONLY;
};

/**
 * The variables SvelteKit 2 gives the browser: those with the public prefix, and not the private one.
 *
 * @param env - every variable, by name.
 * @param publicPrefix - `env.publicPrefix` (`PUBLIC_`).
 * @param privatePrefix - `env.privatePrefix` (empty by default).
 */
export const publicVariables = (
  env: Readonly<Record<string, string>>,
  publicPrefix: string,
  privatePrefix: string
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(env).filter(
      ([name]) => name.startsWith(publicPrefix) && (privatePrefix === "" || !name.startsWith(privatePrefix))
    )
  );

/**
 * A module of named exports, one per variable: what a name JavaScript cannot export is left out.
 *
 * @param values - the values, by name.
 */
export const namedExports = (values: Readonly<Record<string, unknown>>): string =>
  Object.entries(values)
    .filter(([name]) => IDENTIFIER.test(name) && !RESERVED.has(name))
    .map(([name, value]) => `export const ${name} = ${written(value)};\n`)
    .join("");

/**
 * A value checked by a variable's schema: a function, or a Standard Schema (`zod`, `valibot`).
 *
 * @param schema - the variable's `schema`.
 * @param value - the variable's text, or none.
 * @param name - the variable's name, for the error.
 */
const checked = async (schema: unknown, value: string | undefined, name: string): Promise<unknown> => {
  if (typeof schema === "function") return Reflect.apply(schema, undefined, [value]);
  const standard = isRecord(schema) ? schema["~standard"] : undefined;
  if (!isRecord(standard) || typeof standard["validate"] !== "function") {
    // SvelteKit wants a variable with no schema set, an empty text included
    if (value === undefined)
      throw new Error(
        `The public variable ${name} is missing: set it, or give it a schema that makes it optional`
      );
    return value;
  }
  const result: unknown = await Reflect.apply(standard["validate"], standard, [value]);
  if (isRecord(result) && Array.isArray(result["issues"]))
    throw new Error(`The public variable ${name} is not valid: ${JSON.stringify(result["issues"])}`);
  return isRecord(result) ? result["value"] : value;
};

/**
 * The public variables a SvelteKit 3 project declares in `src/env.ts`, checked by their schemas.
 *
 * @param srcDir - the project's source folder (`src`).
 * @param env - every variable, by name.
 * @param aliases - the project's aliases.
 * @returns the values by name, and the files read; none without an env file.
 */
export const declaredPublicVariables = async (
  srcDir: string,
  env: Readonly<Record<string, string>>,
  aliases: readonly Alias[] = []
): Promise<{ readonly values: Record<string, unknown>; readonly file: string } | undefined> => {
  const file = ENV_FILES.map((name) => join(srcDir, name)).find((path) => existsSync(path));
  if (file === undefined) return undefined;
  // the project's aliases, as SvelteKit gives them to its env file (`$lib/…`)
  const { module } = await runnerImport<Record<string, unknown>>(file, {
    configFile: false,
    logLevel: "silent",
    resolve: { alias: [...aliases] }
  });
  const variables = module["variables"];
  const values: Record<string, unknown> = {};
  for (const [name, declared] of Object.entries(isRecord(variables) ? variables : {}))
    if (isRecord(declared) && declared["public"] === true)
      values[name] = await checked(declared["schema"], env[name], name);
  return { values, file };
};
