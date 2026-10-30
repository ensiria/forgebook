/**
 * The Vite config of a package's test instance of the frame page: the catalogue's plugin and the host name the
 * container's browser asks for.
 *
 * @remarks
 * Published (`forgebook/testing/vite`; D-167). The package's `vite.config.ts` beside its specs exports it.
 * Vite serves files up to its workspace root (the monorepo's, or the package's alone), which covers the package's
 * sources, the libraries it builds on and this kit's fonts.
 *
 * @module
 */

// Node loads this module itself, as Vite leaves a workspace package out of the config bundle: hence the extension
import { forgebookPlugin } from "forgebook/vite";
import type { FrameworkAdapter } from "forgebook/vite/adapter";
import type { UserConfig } from "vite";

/**
 * The test frame page's Vite config.
 *
 * @param dir - the folder of the frame page (Vite's root).
 * @param framework - the framework the stories are written for (`react()` of `@forgebook/react/vite`).
 */
export const storyTestViteConfig = (dir: string, framework: FrameworkAdapter): UserConfig => ({
  root: dir,
  plugins: [forgebookPlugin({ framework })],
  // the visual tests' browser runs in a container and asks for the host by this name
  server: { allowedHosts: ["host.docker.internal"] }
});
