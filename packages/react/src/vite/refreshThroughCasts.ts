/**
 * Lets Fast Refresh find a component whose declaration casts it, as a library does to keep a generic signature through
 * `forwardRef` (`export const Button = forwardRef(…) as <T>(props: Props<T>) => ReactElement`).
 *
 * @remarks
 * Vite's transformer registers a component for Fast Refresh while it strips the types, and misses one wrapped in a
 * cast: the file is then no refresh boundary, and an edit of the component reloads the whole page, losing every
 * story's state. On a dev server, such a file has its types stripped first, its JSX kept, so the second pass sees the
 * call itself. Only a file that casts a `forwardRef(` or `memo(` call is read twice.
 *
 * @module
 */
import type { Plugin } from "vite";

/** A cast after a `forwardRef(` or `memo(` call: `forwardRef(…) as`. */
const CAST_AFTER_CALL = /\b(?:forwardRef|memo)\([\s\S]*?\)\s*as\s/;

/**
 * The plugin.
 *
 * @returns a plugin for the dev server, which runs before React's.
 */
export const refreshThroughCasts = (): Plugin => ({
  name: "forgebook:react-refresh-through-casts",
  apply: "serve",
  enforce: "pre",
  transform: {
    filter: { id: { include: /\.tsx?$/, exclude: /\/node_modules\// }, code: /\b(?:forwardRef|memo)\(/ },
    handler: async (code: string, id: string): Promise<{ code: string; map: string | null } | undefined> => {
      if (!CAST_AFTER_CALL.test(code)) return undefined;
      const { transformWithOxc } = await import("vite");
      const stripped = await transformWithOxc(code, id, {
        lang: id.endsWith("x") ? "tsx" : "ts",
        jsx: "preserve"
      });
      // the map as text: the transformer's own type is not the one a plugin's answer names
      return { code: stripped.code, map: stripped.map === undefined ? null : JSON.stringify(stripped.map) };
    }
  }
});
