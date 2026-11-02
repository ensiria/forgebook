/**
 * The `forgebook.config.ts` that `forgebook init` writes, from what an importer read of another tool's files.
 *
 * @remarks
 * Pure: the configuration in, the file's text out. The file is written as a person would write it (the `defineConfig`
 * of the README, one field a line), so it is the project's from then on; the switches read from Storybook's
 * `globalTypes` are written out as Forgebook's own, applied by code as Storybook's decorators expect, so a person can
 * tell each to apply as an attribute or a class later.
 *
 * @module
 */
import type { ImportedConfig } from "./importers/storybook.ts";

/** The file `forgebook init` writes. */
export const CONFIG_FILE = "forgebook.config.ts";

/**
 * A value written as TypeScript source: JSON with its keys unquoted where they are names, indented to sit at a depth of
 * the file.
 *
 * @param value - a plain value.
 * @param indent - the depth's spaces.
 */
const sourceOf = (value: unknown, indent: string): string =>
  JSON.stringify(value, null, 2)
    .replace(/^(\s*)"([A-Za-z_$][\w$]*)":/gm, "$1$2:")
    .split("\n")
    .join(`\n${indent}`);

/**
 * The framework's options as its adapter's argument (`{ tsconfig: ".storybook/tsconfig.json" }`), empty for none.
 *
 * @param options - the options read.
 */
const adapterOptions = (options: Readonly<Record<string, string>> | undefined): string => {
  const entries = Object.entries(options ?? {});
  if (entries.length === 0) return "";
  return `{ ${entries.map(([name, value]) => `${name}: ${JSON.stringify(value)}`).join(", ")} }`;
};

/**
 * The configuration file's text.
 *
 * @param imported - what the importer read.
 * @param tool - the tool's name, for the file's comment (`Storybook`).
 */
export const initConfigText = (imported: ImportedConfig, tool: string): string => {
  const fields = [
    `  framework: ${imported.framework}(${adapterOptions(imported.frameworkOptions)}),`,
    `  title: ${JSON.stringify(imported.title)},`,
    `  stories: ${sourceOf(imported.stories, "  ")},`,
    ...(imported.preview === undefined ? [] : [`  preview: ${JSON.stringify(imported.preview)},`]),
    ...(imported.switches === undefined
      ? []
      : [
          `  // from the preview's globalTypes: applied by code, as ${tool}'s decorators read them`,
          `  switches: ${sourceOf(imported.switches, "  ")},`
        ])
  ];
  // the last field takes no comma
  const last = fields.length - 1;
  fields[last] = fields[last]?.replace(/,$/, "") ?? "";
  return [
    "/**",
    ` * The catalogue's configuration, written by \`forgebook init --from ${tool.toLowerCase()}\` from ${tool}'s files.`,
    " *",
    " * @module",
    " */",
    `import { ${imported.framework} } from "@forgebook/${imported.framework}/vite";`,
    'import { defineConfig } from "forgebook";',
    "",
    "export default defineConfig({",
    ...fields,
    "});",
    ""
  ].join("\n");
};
