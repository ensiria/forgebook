/**
 * Forgebook's adapter for Next.js, for the Vite plugin: `defineConfig({ framework: nextjs() })`.
 *
 * @remarks
 * Next.js is React: the props are read as React's, and the stories drawn with React's renderer, wrapped so each has
 * its route, its request and its server components (`@forgebook/nextjs/frame`). What Next.js adds is Vite's work:
 * React's plugin, and this package's plugins for Next.js's modules, fonts, images, variables and style sheets
 * (`nextPlugin.ts`). Forgebook stays on Vite: a Next.js project's Turbopack or webpack configuration is not read.
 *
 * @module
 */
import { extname } from "node:path";

import { react } from "@forgebook/react/vite";
import type { FrameworkAdapter } from "forgebook/vite/adapter";
import type { PluginOption } from "vite";

import { type NextjsOptions, nextPlugins } from "./nextPlugin.ts";

/**
 * Next.js, as the plugin reads and draws its components.
 *
 * @param options - the project's folder, its `next.config`, how Google fonts are had.
 * @returns the adapter.
 */
export const nextjs = (options: NextjsOptions = {}): FrameworkAdapter => {
  const base = react();
  return {
    name: "nextjs",
    // beside this module, with its extension: `.ts` in the sources, `.js` once built for npm
    docsModule: new URL(`./extractDocs${extname(import.meta.url)}`, import.meta.url).href,
    pages: { frame: "@forgebook/nextjs/frame", code: base.pages.code },
    // Next.js's own components the stand-ins keep, pre-bundled with React's modules
    browserDependencies: [
      ...(base.browserDependencies ?? []),
      "next/dist/shared/lib/image-external.js",
      "next/dist/client/legacy/image.js",
      "next/dist/client/script.js"
    ],
    vitePlugins: async (): Promise<readonly PluginOption[]> => [
      ...((await base.vitePlugins?.()) ?? []),
      ...nextPlugins(options)
    ]
  };
};
