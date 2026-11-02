/**
 * React Spectrum's catalogue for the benchmark: the stories of its Storybook, from every package of the monorepo.
 *
 * @remarks
 * Its Storybook runs on Parcel, whose rules a library's code relies on, so they are written here for Vite, through the
 * framework's plugins since Forgebook's configuration has no key for Vite:
 * - packages resolve to their sources by the `source` condition;
 * - a package's translations are imported with a glob (`./intl/*.json`), and a file's text with `bundle-text:`;
 * - an import may start from the monorepo's root (`/packages/…`) or name a starter (`vanilla-starter/…`);
 * - every style sheet of its components is a CSS module whatever its name, which Vite tells by the name, so those ids
 *   carry it in their query;
 * - an icon's stories import its built CommonJS file (`../Add`), which Parcel reads and Vite serves as it is: they get
 *   the icon's source;
 * - a class may compose one written further down its file, as Lightning CSS lets it and PostCSS's CSS modules do not:
 *   those `composes` move to the file's end before Vite reads the sheet.
 *
 * @module
 */
import { existsSync, globSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";

import { react } from "@forgebook/react/vite";
import { defineConfig } from "forgebook";

const framework = react();

/** The id a glob of translations resolves to. */
const INTL_PREFIX = "\0bench-intl:";

/** A glob of a package's translations. */
const INTL_GLOB = /\*\.json$/;

/** What Parcel writes before a file it imports as text. */
const TEXT_PREFIX = "bundle-text:";

/** Where a style sheet is a CSS module that does not say so: anywhere in the monorepo's packages. */
const MODULE_IMPORTER = /\/packages\//;

/** PostCSS, from the monorepo, whose own style sheets it builds. */
const postcss = createRequire(resolve(import.meta.dirname, "../package.json"))("postcss");

/** The query of a style sheet read as a CSS module. */
const MODULE_QUERY = "?.module.css";

/**
 * A style sheet whose `composes` come after every class, in rules of their own: a rule that composes only composes,
 * and writes nothing, so moving it changes no style.
 */
const composesLast = (css, from) => {
  const root = postcss.parse(css, { from });
  const moved = [];
  root.each((node) => {
    if (node.type !== "rule") return;
    const composes = node.nodes.filter((child) => child.type === "decl" && child.prop === "composes");
    if (composes.length === 0) return;
    moved.push(postcss.rule({ selector: node.selector, nodes: composes.map((each) => each.clone()) }));
    for (const each of composes) each.remove();
    if (node.nodes.length === 0) node.remove();
  });
  if (moved.length === 0) return null;
  root.append(moved);
  return root.toString();
};

/** An icon package's stories, which import each icon from the package's folder. */
const ICON_STORIES = /\/@spectrum-icons\/[^/]+\/stories\//;

/** The source of an icon an icon's story imports from the package's folder, when it has one. */
const iconSource = (source, importer) => {
  if (!ICON_STORIES.test(importer) || !source.startsWith("../")) return null;
  const file = join(dirname(importer), "..", "src", `${basename(source)}.tsx`);
  return existsSync(file) ? file : null;
};

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
    const icon = iconSource(source, importer);
    if (icon !== null) return icon;
    if (source.endsWith(".css") && MODULE_IMPORTER.test(importer)) {
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved === null ? null : `${resolved.id}${MODULE_QUERY}`;
    }
    if (source.startsWith(TEXT_PREFIX))
      return `${join(dirname(importer), source.slice(TEXT_PREFIX.length))}?raw`;
    return INTL_GLOB.test(source) ? `${INTL_PREFIX}${join(dirname(importer), dirname(source))}` : null;
  },
  load: (id) => (id.startsWith(INTL_PREFIX) ? intlModule(id.slice(INTL_PREFIX.length)) : null),
  transform: (code, id) => (id.endsWith(MODULE_QUERY) ? composesLast(code, id) : null),
  config: () => ({
    resolve: {
      conditions: ["source", "module", "browser", "development|production"],
      alias: [
        { find: /^\/packages\//, replacement: `${resolve(import.meta.dirname, "../packages")}/` },
        // the starters' components, which its stories import by these names (its tsconfig.json's paths)
        {
          find: /^vanilla-starter\//,
          replacement: `${resolve(import.meta.dirname, "../starters/docs/src")}/`
        },
        {
          find: /^tailwind-starter\//,
          replacement: `${resolve(import.meta.dirname, "../starters/tailwind/src")}/`
        }
      ]
    },
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
