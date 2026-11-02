/**
 * React Spectrum's catalogue for the benchmark: the stories of its Storybook, from every package of the monorepo.
 *
 * @remarks
 * Its Storybook runs on Parcel, whose rules a library's code relies on, so they are written here for Vite, through the
 * framework's plugins since Forgebook's configuration has no key for Vite: packages resolve to their sources by the
 * `source` condition, and a package's translations are imported with a glob (`./intl/*.json`).
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
  resolveId: (source, importer) =>
    INTL_GLOB.test(source) && importer !== undefined
      ? `${INTL_PREFIX}${join(dirname(importer), dirname(source))}`
      : null,
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
