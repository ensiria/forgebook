/**
 * Where Vite keeps a catalogue's caches (its pre-bundled dependencies, Forgebook's own): the package's
 * `node_modules/.vite`, as Vite places it, and a folder of its own inside for a catalogue that sits deeper in the
 * package.
 *
 * @remarks
 * Two catalogues of one package (the fixture app and its white-label catalogue) would otherwise share one folder of
 * pre-bundled dependencies, each writing over the other's while it serves from it.
 *
 * @module
 */
import { existsSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

/**
 * The cache folder of a catalogue.
 *
 * @param configDir - the folder of the catalogue's configuration file.
 */
export const catalogueCacheDir = (configDir: string): string => {
  let folder = configDir;
  while (!existsSync(join(folder, "package.json"))) {
    const parent = dirname(folder);
    if (parent === folder) return join(configDir, ".vite");
    folder = parent;
  }
  const base = join(folder, "node_modules", ".vite");
  return folder === configDir
    ? base
    : join(base, "catalogues", relative(folder, configDir).split(sep).join("-"));
};
