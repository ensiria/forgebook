/**
 * Whether a file is Forgebook's own: a module of the catalogue (its shell, its frame, this package) that a React Native
 * project's compiling must leave alone, wherever it is installed.
 *
 * @remarks
 * A file outside `node_modules` is taken for the project's own, so React Native's compiling (JSX in `.js`, the JSX
 * import source, `require` of assets) reaches a monorepo's linked packages. Forgebook's own packages can be linked the
 * same way (a monorepo that develops a catalogue beside it, or this repository): they are told by the name of the
 * package that holds them, `forgebook` or `@forgebook/…`, read once per folder.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** The name of the package each folder is in, by folder; none for a folder outside any package. */
const packageNames = new Map<string, string | undefined>();

/**
 * The name of the package a folder is in: its own `package.json`'s, or its parent's.
 *
 * @param dir - the folder, absolute.
 */
const packageNameOf = (dir: string): string | undefined => {
  if (packageNames.has(dir)) return packageNames.get(dir);
  let name: string | undefined;
  try {
    const manifest: unknown = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    name =
      typeof manifest === "object" &&
      manifest !== null &&
      "name" in manifest &&
      typeof manifest.name === "string"
        ? manifest.name
        : "";
  } catch {
    const parent = dirname(dir);
    name = parent === dir ? undefined : packageNameOf(parent);
  }
  packageNames.set(dir, name);
  return name;
};

/**
 * Whether a file is in one of Forgebook's packages.
 *
 * @param file - the file's path, absolute, its query left out.
 */
export const isForgebookFile = (file: string): boolean => {
  const name = packageNameOf(dirname(file));
  return name !== undefined && (name === "forgebook" || name.startsWith("@forgebook/"));
};
