/**
 * Makes the dev server resolve a package on Node with the export conditions its pages resolve it with, so the stories
 * and previews it loads for tools are the files the frames draw.
 *
 * @remarks
 * Vite gives its server environment conditions of its own (`module`, `node`): a catalogue's `resolve.conditions`
 * reaches the pages only. A monorepo that points its packages at their sources with a condition (`source`) is then
 * read from their builds on the server, or not at all where nothing is built, and a preview that imports one cannot
 * load there. So the server takes the pages' conditions too, except `browser`, which would pick a package's browser
 * build on Node. A catalogue that names the server's conditions itself (`ssr.resolve.conditions`,
 * `environments.ssr.resolve.conditions`) keeps them. The hook runs after every other plugin's, so the conditions a
 * framework's or the catalogue's plugins add are read as well.
 *
 * @module
 */
import { defaultServerConditions, type Plugin, type UserConfig } from "vite";

/** The condition that names a package's build for browsers, which Node cannot run. */
const BROWSER = "browser";

/**
 * The conditions the server resolves with for this configuration, or `undefined` to leave Vite's.
 *
 * @param config - Vite's configuration, every plugin's included.
 */
export const serverConditionsOf = (config: UserConfig): readonly string[] | undefined => {
  const pages = config.resolve?.conditions;
  if (pages === undefined) return undefined;
  if (config.ssr?.resolve?.conditions !== undefined) return undefined;
  if (config.environments?.["ssr"]?.resolve?.conditions !== undefined) return undefined;
  return [...new Set([...pages.filter((condition) => condition !== BROWSER), ...defaultServerConditions])];
};

/**
 * The plugin.
 *
 * @returns a plugin that sets the server environment's conditions after the other plugins set theirs.
 */
export const serverConditions = (): Plugin => ({
  name: "forgebook:server-conditions",
  config: {
    order: "post",
    handler: (config: UserConfig): UserConfig | undefined => {
      const conditions = serverConditionsOf(config);
      return conditions === undefined
        ? undefined
        : { environments: { ssr: { resolve: { conditions: [...conditions] } } } };
    }
  }
});
