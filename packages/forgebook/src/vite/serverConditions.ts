/**
 * Makes the dev server resolve a package on Node with the export conditions its pages resolve it with, so the stories
 * and previews it loads for tools are the files the frames draw.
 *
 * @remarks
 * Vite gives its server environment conditions of its own (`module`, `node`): a catalogue's `resolve.conditions`
 * reaches the pages only. A monorepo that points its packages at their sources with a condition (`source`) is then
 * read from their builds on the server, or not at all where nothing is built, and a preview that imports one cannot
 * load there. So the server takes the pages' conditions too, except those of another runtime (`browser`, which would
 * pick a package's browser build on Node, `worker`, `react-native`). A plugin that names the server's conditions
 * itself (`ssr.resolve.conditions`, `environments.ssr.resolve.conditions`) keeps them. The hook runs after every other
 * plugin's, so the conditions a framework's or the catalogue's plugins add are read as well; one a plugin sets in its
 * `configEnvironment` hook is not. Only the `forgebook` command's server has it: an app that runs the catalogue's
 * plugin in a Vite configuration of its own names the server's conditions there.
 *
 * @module
 */
import { defaultServerConditions, type Plugin, type UserConfig } from "vite";

/**
 * The conditions that name a build for another runtime than Node's: a package's browser build, a worker's, a native
 * app's, another server runtime's. Node cannot run them, so the server leaves them out.
 */
const OTHER_RUNTIMES: ReadonlySet<string> = new Set([
  "browser",
  "worker",
  "react-native",
  "deno",
  "bun",
  "workerd",
  "edge-light"
]);

/**
 * The conditions the server resolves with for this configuration, or `undefined` to leave Vite's: none named for the
 * pages, the server's named, or a server that runs as a web worker, which Vite gives the pages' conditions already.
 *
 * @param config - Vite's configuration, every plugin's included.
 */
export const serverConditionsOf = (config: UserConfig): readonly string[] | undefined => {
  const pages = config.environments?.["client"]?.resolve?.conditions ?? config.resolve?.conditions;
  if (pages === undefined) return undefined;
  if (config.ssr?.target === "webworker") return undefined;
  if (config.ssr?.resolve?.conditions !== undefined) return undefined;
  if (config.environments?.["ssr"]?.resolve?.conditions !== undefined) return undefined;
  const forNode = pages.filter((condition) => !OTHER_RUNTIMES.has(condition));
  return [...new Set([...forNode, ...defaultServerConditions])];
};

/**
 * The plugin.
 *
 * @returns a plugin that sets the server environment's conditions after the other plugins set theirs.
 */
export const serverConditions = (): Plugin => ({
  name: "forgebook:server-conditions",
  // a build loads nothing on the server, and an environment added to it would reach every plugin's hooks
  apply: "serve",
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
