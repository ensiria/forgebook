/**
 * A story error's stack with the lines of the files as written: the dev server maps each place the browser names
 * through the source map of the module it served there.
 *
 * @remarks
 * A browser writes a stack in the lines of the code it ran, which Vite transformed (types taken out, JSX turned into
 * calls, imports rewritten), so a throw on line 3 of a story file reads as line 19. Devtools map them; the text of
 * `error.stack` a frame shows does not. The dev server already holds each module's map, so the frame sends the stack
 * and gets it back mapped: no decoder or map is loaded in the frame. Only places in a module the server served and
 * whose map points back to that module's own file are rewritten; the rest (a prebundled dependency, the browser's own
 * code) stay as they were. Used by the plugin for a frame's live error (`liveErrors.ts`).
 *
 * @module
 */

import { SourceMap } from "node:module";
import { fileURLToPath } from "node:url";

import { VITE_PATHS } from "./vitePaths.ts";

/** A module the dev server served, as the mapping needs it. */
export type ServedModule = {
  /** Its file, as Vite writes ids. */
  readonly file: string;
  /** The map from the code served to its file. */
  readonly map: {
    readonly version: number;
    readonly sources: readonly string[];
    readonly names: readonly string[];
    readonly mappings: string;
  };
};

/** Finds the module served at an address: none when the server served nothing there, or keeps no map of it. */
export type ModuleLookup = (url: string) => Promise<ServedModule | undefined>;

/** A stack with its places mapped. */
export type MappedStack = {
  /** The stack, each place it could map in the lines of the file as written. */
  readonly stack: string;
  /**
   * The first mapped place outside `node_modules`, as `file:line:column` with the file relative to the project:
   * most often the line of the story or component that threw. None when no place could be mapped.
   */
  readonly place?: string;
};

/** The longest stack mapped, in characters: a frame reports its own errors, yet the connection takes any text. */
export const MAX_STACK_LENGTH = 16_000;

/** The most places of one stack looked up. */
const MAX_PLACES = 50;

/**
 * A place in a stack: an address, then its line and column, in Chrome's (`(http://…:19:9)`), Firefox's and Safari's
 * (`render@http://…:19:9`) forms.
 */
const PLACE = /(https?:\/\/[^\s()]+?):(\d+):(\d+)(?=\)|\s|$)/g;

/**
 * A source of a map as a path Vite writes: a map may name it absolute, as a `file:` address, or relative to the file.
 *
 * @param source - the source as the map names it.
 * @param file - the module's file.
 */
const sourcePath = (source: string, file: string): string => {
  if (source.startsWith("file:")) return VITE_PATHS.normalize(fileURLToPath(source));
  return VITE_PATHS.resolve(VITE_PATHS.dirname(file), source);
};

/**
 * Where a place of the served code was written, in its module's own file: none when the map does not lead there.
 *
 * @param module - the module served at the place's address.
 * @param line - the line in the code served, from 1.
 * @param column - the column in the code served, from 1.
 */
const originOf = (
  module: ServedModule,
  line: number,
  column: number
): { readonly line: number; readonly column: number } | undefined => {
  const map = new SourceMap({
    file: module.file,
    version: module.map.version,
    sources: [...module.map.sources],
    sourcesContent: [],
    names: [...module.map.names],
    mappings: module.map.mappings,
    sourceRoot: ""
  });
  const origin = map.findOrigin(line, column);
  if (!("lineNumber" in origin)) return undefined;
  if (sourcePath(origin.fileName, module.file) !== module.file) return undefined;
  return { line: origin.lineNumber, column: origin.columnNumber };
};

/**
 * Maps a stack's places to the lines of their files as written.
 *
 * @param stack - the stack, as the browser wrote it.
 * @param lookup - finds the module served at an address.
 * @param root - the project's folder, which `place` is written relative to.
 * @returns the stack mapped, and its first place in the project; the stack as it was past `MAX_STACK_LENGTH`.
 */
export const mappedStack = async (
  stack: string,
  lookup: ModuleLookup,
  root: string
): Promise<MappedStack> => {
  if (stack.length > MAX_STACK_LENGTH) return { stack };
  const places = [...stack.matchAll(PLACE)].slice(0, MAX_PLACES);
  const urls = [...new Set(places.map((match) => match[1] ?? ""))];
  const found = await Promise.all(
    urls.map(async (url): Promise<[string, ServedModule | undefined]> => [url, await lookup(url)])
  );
  const modules = new Map(found);
  let place: string | undefined;
  let mapped = "";
  let from = 0;
  for (const match of places) {
    const [whole, url = "", line = "", column = ""] = match;
    const module = modules.get(url);
    const origin = module === undefined ? undefined : originOf(module, Number(line), Number(column));
    if (module === undefined || origin === undefined) continue;
    mapped += `${stack.slice(from, match.index)}${url}:${origin.line}:${origin.column}`;
    from = match.index + whole.length;
    if (place === undefined && !module.file.includes("/node_modules/"))
      place = `${VITE_PATHS.relative(root, module.file)}:${origin.line}:${origin.column}`;
  }
  mapped += stack.slice(from);
  return place === undefined ? { stack: mapped } : { stack: mapped, place };
};
