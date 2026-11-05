/**
 * The ids of the modules the plugin makes: a pattern's story files or docs pages, the configuration's data, the design
 * tokens, a group's "Used in", reach and texts. Pure: a specifier in, an id out.
 *
 * @module
 */
import { CONFIG_MODULE, TOKENS_MODULE } from "./pages.ts";
import { FILES_PREFIX } from "./pluginModules.ts";
import {
  DOCS_PAGES_SPECIFIER_PREFIX,
  FILES_SPECIFIER_PREFIX,
  GROUP_SEPARATOR,
  PAGES_SEARCH_PREFIX,
  REACH_PREFIX,
  SEARCH_PREFIX,
  storyFilesGroupText,
  TEXTS_PREFIX,
  USAGE_PREFIX
} from "./storyFilesModule.ts";

/** The query that asks for the story files a pattern matches (`../src/**\/*.stories.tsx?forgebook-files`). */
const FILES_QUERY = "?forgebook-files";

/** The query that asks for the docs pages a pattern matches (`./docs/*.md?forgebook-docs-pages`). */
const DOCS_PAGES_QUERY = "?forgebook-docs-pages";

/** The id of a group of docs pages: virtual, with the declaring module's folder and the patterns after it. */
export const DOCS_PAGES_PREFIX = `\0${DOCS_PAGES_SPECIFIER_PREFIX}`;

/**
 * The id of a `?forgebook-files` module: its prefix, then its group (`storyFilesGroupText`), which holds no `..`.
 *
 * @param folder - the importing module's folder.
 * @param pattern - the pattern as the import writes it.
 */
const filesId = (folder: string, pattern: string): string =>
  `${FILES_PREFIX}${storyFilesGroupText(folder, [pattern])}`;

/**
 * The id of a pattern's module, when an import asks for one: its story files, or its docs pages.
 *
 * @param source - the import's specifier.
 * @param folder - the importing module's folder.
 */
export const patternId = (source: string, folder: string): string | null => {
  // the separator of a group's id: a folder that holds it would read back as patterns of its own
  if (folder.includes(GROUP_SEPARATOR)) return null;
  if (source.endsWith(FILES_QUERY)) return filesId(folder, source.slice(0, -FILES_QUERY.length));
  if (!source.endsWith(DOCS_PAGES_QUERY)) return null;
  const pattern = source.slice(0, -DOCS_PAGES_QUERY.length);
  return `${DOCS_PAGES_PREFIX}${storyFilesGroupText(folder, [pattern])}`;
};

/**
 * The specifiers' prefixes of a group's virtual modules: the group named by its patterns (story files or docs pages),
 * its "Used in", its reach, its search indexes, its texts.
 */
const VIRTUAL_PREFIXES: readonly string[] = [
  FILES_SPECIFIER_PREFIX,
  DOCS_PAGES_SPECIFIER_PREFIX,
  USAGE_PREFIX,
  REACH_PREFIX,
  SEARCH_PREFIX,
  PAGES_SEARCH_PREFIX,
  TEXTS_PREFIX
];

/**
 * The id of a virtual module the plugin makes (the configuration's data, the tokens, a group's "Used in", reach,
 * search indexes or texts), when the import names one.
 *
 * @param source - the import's specifier.
 */
export const virtualId = (source: string): string | undefined => {
  if (source === CONFIG_MODULE) return CONFIG_ID;
  if (source === TOKENS_MODULE) return TOKENS_ID;
  return VIRTUAL_PREFIXES.some((prefix) => source.startsWith(prefix)) ? `\0${source}` : undefined;
};

/**
 * Whether an id names a group's module: one whose patterns are written in the id itself, so that whoever writes the id
 * chooses what the plugin reads.
 *
 * @param id - the module's id.
 */
export const isGroupId = (id: string): boolean =>
  VIRTUAL_PREFIXES.some((prefix) => id.startsWith(`\0${prefix}`));

/** The resolved id of the configuration's data module. */
export const CONFIG_ID = `\0${CONFIG_MODULE}`;

/** The resolved id of the design tokens' module. */
export const TOKENS_ID = `\0${TOKENS_MODULE}`;
