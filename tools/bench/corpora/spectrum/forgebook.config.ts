/**
 * React Spectrum's catalogue for the benchmark: the stories of its Storybook, from every package of the monorepo.
 *
 * @remarks
 * Its Storybook runs on Parcel, whose rules a library's code relies on, so they are written here for Vite, through the
 * framework's plugins since Forgebook's configuration has no key for Vite: packages resolve to their sources by the
 * `source` condition, a package's translations are imported with a glob (`./intl/*.json`), and a file's text with
 * `bundle-text:`, and every style sheet of its components is a CSS module whatever its name, which Vite tells by the
 * name, so those ids carry it in their query.
 *
 * @module
 */
import { globSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { react } from "@forgebook/react/vite";
import { defineConfig } from "forgebook";

const framework = react();

/** The id a glob of translations resolves to. */
const INTL_PREFIX = "\0bench-intl:";

/** A glob of a package's translations. */
const INTL_GLOB = /\*\.json$/;

/** What Parcel writes before a file it imports as text. */
const TEXT_PREFIX = "bundle-text:";

/** Where a style sheet is a CSS module that does not say so: imported by Spectrum's components. */
const MODULE_IMPORTER = /\/packages\/@(adobe|react-spectrum)\//;

/** The translations of a folder, as Parcel's glob resolver gives them: by file name, without its extension. */
const intlModule = (folder) => {
  const entries = globSync("*.json", { cwd: folder }).map((file) => [
    basename(file, ".json"),
    JSON.parse(readFileSync(join(folder, file), "utf8"))
  ]);
  return `export default ${JSON.stringify(Object.fromEntries(entries))};`;
};

/** What Spectrum's Parcel does. */
const spectrumVite = {
  name: "bench-spectrum",
  enforce: "pre",
  async resolveId(source, importer, options) {
    if (importer === undefined) return null;
    if (source.endsWith(".css") && MODULE_IMPORTER.test(importer)) {
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved === null ? null : `${resolved.id}?.module.css`;
    }
    if (source.startsWith(TEXT_PREFIX))
      return `${join(dirname(importer), source.slice(TEXT_PREFIX.length))}?raw`;
    return INTL_GLOB.test(source) ? `${INTL_PREFIX}${join(dirname(importer), dirname(source))}` : null;
  },
  load: (id) => (id.startsWith(INTL_PREFIX) ? intlModule(id.slice(INTL_PREFIX.length)) : null),
  config: () => ({
    resolve: { conditions: ["source", "module", "browser", "development|production"] },
    css: { transformer: "postcss", modules: { localsConvention: "camelCase" } }
  })
};

export default defineConfig({
  framework: {
    ...framework,
    vitePlugins: async () => [spectrumVite, ...((await framework.vitePlugins?.()) ?? [])]
  },
  title: "React Spectrum",
  stories: [
    "../packages/@{react-aria,react-stately,spectrum-icons}/*/stories/*.stories.{js,jsx,ts,tsx}",
    "../packages/@react-spectrum/!(s2|ai)/stories/*.stories.{js,jsx,ts,tsx}",
    "../packages/@adobe/react-spectrum/stories/*/*.stories.{js,jsx,ts,tsx}",
    "../packages/react-aria/stories/*/*.stories.{js,jsx,ts,tsx}",
    "../packages/react-stately/stories/*/*.stories.{js,jsx,ts,tsx}",
    "../packages/react-aria-components/stories/*.stories.{js,jsx,ts,tsx}"
  ]
});
