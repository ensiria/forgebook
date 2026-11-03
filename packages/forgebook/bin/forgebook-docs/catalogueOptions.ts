/**
 * How a package sets its `CATALOG.md`: the `forgebook.catalog` key of its `package.json`, checked. A library has no
 * catalogue configuration of its own, and the key travels with the package.
 *
 * @module
 */

/** The kinds of entries the file lists, in the order they are written by default. */
export const CATALOGUE_SECTIONS = [
  "components",
  "pages",
  "modules",
  "sassModules",
  "styleSheets",
  "tokens"
] as const;

/** One kind of entries. */
export type CatalogueSection = (typeof CATALOGUE_SECTIONS)[number];

/** How a package's `CATALOG.md` is written. */
export type CatalogueOptions = {
  /** The file's name, in the package's folder. @defaultValue `"CATALOG.md"` */
  readonly file: string;
  /** The kinds of entries it lists, in this order. @defaultValue every kind, components first */
  readonly sections: readonly CatalogueSection[];
  /** Export subpaths left out (`./internal/tokens`); a trailing `*` leaves out every subpath it starts. */
  readonly exclude: readonly string[];
};

/** The options of a package that sets none. */
export const DEFAULT_CATALOGUE_OPTIONS: CatalogueOptions = {
  file: "CATALOG.md",
  sections: CATALOGUE_SECTIONS,
  exclude: []
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a value is a list of strings. */
const isStringList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/** Whether a text names a kind of entries. */
const isSection = (value: string): value is CatalogueSection =>
  CATALOGUE_SECTIONS.some((section) => section === value);

/** The file's name, or the default with a problem when it is set wrongly. */
const fileOf = (value: unknown, problems: string[]): string => {
  if (value === undefined) return DEFAULT_CATALOGUE_OPTIONS.file;
  if (typeof value === "string" && value !== "" && !value.includes("/")) return value;
  problems.push("forgebook.catalog.file must be a file name in the package's folder");
  return DEFAULT_CATALOGUE_OPTIONS.file;
};

/** The sections, or the default with a problem when they are set wrongly. */
const sectionsOf = (value: unknown, problems: string[]): readonly CatalogueSection[] => {
  if (value === undefined) return DEFAULT_CATALOGUE_OPTIONS.sections;
  if (isStringList(value) && value.every(isSection)) return value.filter(isSection);
  problems.push(`forgebook.catalog.sections must list some of: ${CATALOGUE_SECTIONS.join(", ")}`);
  return DEFAULT_CATALOGUE_OPTIONS.sections;
};

/** The exclusions, or none with a problem when they are set wrongly. */
const excludeOf = (value: unknown, problems: string[]): readonly string[] => {
  if (value === undefined) return [];
  if (isStringList(value)) return value;
  problems.push("forgebook.catalog.exclude must list export subpaths");
  return [];
};

/**
 * A package's catalogue options, from its manifest, with what is wrong in them.
 *
 * @param manifest - the package's `package.json`, parsed.
 * @returns the options (the defaults where it sets none or sets them wrongly) and one message per mistake.
 */
export const catalogueOptionsOf = (
  manifest: unknown
): { readonly options: CatalogueOptions; readonly problems: readonly string[] } => {
  const forgebook = isRecord(manifest) ? manifest["forgebook"] : undefined;
  const catalog = isRecord(forgebook) ? forgebook["catalog"] : undefined;
  if (catalog === undefined) return { options: DEFAULT_CATALOGUE_OPTIONS, problems: [] };
  if (!isRecord(catalog))
    return { options: DEFAULT_CATALOGUE_OPTIONS, problems: ["forgebook.catalog is not an object"] };
  const problems: string[] = [];
  const options: CatalogueOptions = {
    file: fileOf(catalog["file"], problems),
    sections: sectionsOf(catalog["sections"], problems),
    exclude: excludeOf(catalog["exclude"], problems)
  };
  return { options, problems };
};

/**
 * Whether an export subpath is left out by the options.
 *
 * @param subpath - the subpath (`./internal/tokens`).
 * @param exclude - the options' `exclude`.
 */
export const isExcluded = (subpath: string, exclude: readonly string[]): boolean =>
  exclude.some((pattern) =>
    pattern.endsWith("*") ? subpath.startsWith(pattern.slice(0, -1)) : subpath === pattern
  );
