/**
 * The Custom Elements Manifest of a package (`custom-elements.json`), found and read: the elements it declares, with
 * their attributes, fields, events, slots and parts, as the analyzers of Lit, Stencil and FAST write them.
 *
 * @remarks
 * A package names its manifest in its `package.json` (`"customElements": "custom-elements.json"`, the field the
 * standard defines); without the field, a `custom-elements.json` beside the `package.json` is read. The file is JSON a
 * tool wrote, so every part is checked before use and a part of another shape is left out rather than trusted. A
 * manifest is read again when its file changes, so an analyzer running in watch mode renews the docs.
 *
 * Only what the docs use is read: schema 2.x's modules, their class declarations that are custom elements, and the
 * members, attributes, events, slots and CSS parts of those.
 *
 * @see https://github.com/webcomponents/custom-elements-manifest
 * @module
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

/** A type, as a manifest writes it. */
type ManifestType = {
  /** The type's text, as the source writes it (`"primary" | "danger"`). */
  readonly text: string;
};

/** What a manifest says of an attribute, a field, an event or a slot. */
type Described = {
  /** Its name. */
  readonly name: string;
  /** Its description; empty when it has none. */
  readonly description: string;
};

/** An attribute an element observes. */
export type ManifestAttribute = Described & {
  /** Its type, when written. */
  readonly type: ManifestType | undefined;
  /** Its default, as code. */
  readonly default: string | undefined;
  /** The field it sets, when it has one. */
  readonly fieldName: string | undefined;
};

/** A public field of an element. */
export type ManifestField = Described & {
  /** Its type, when written. */
  readonly type: ManifestType | undefined;
  /** Its default, as code. */
  readonly default: string | undefined;
  /** The attribute that sets it, when it has one. */
  readonly attribute: string | undefined;
  /** Whether it can only be read, so no story sets it. */
  readonly isReadonly: boolean;
};

/** An event an element dispatches. */
export type ManifestEvent = Described & {
  /** The event's type (`CustomEvent<string>`), when written. */
  readonly type: ManifestType | undefined;
};

/** A custom element, as its module declares it. */
export type ManifestElement = Described & {
  /** Its tag; none for a class meant to be extended or defined by its user. */
  readonly tagName: string | undefined;
  /** Its summary, the one-line description some analyzers write beside the description. */
  readonly summary: string;
  /** Why not to use it any more, when deprecated; `true` without a reason. */
  readonly deprecated: string | true | undefined;
  /** The attributes it observes, in the order written. */
  readonly attributes: readonly ManifestAttribute[];
  /** Its public instance fields, in the order written. */
  readonly fields: readonly ManifestField[];
  /** The events it dispatches. */
  readonly events: readonly ManifestEvent[];
  /** Its slots; the unnamed one is named `""`. */
  readonly slots: readonly Described[];
  /** Its CSS parts. */
  readonly cssParts: readonly Described[];
};

/** A module of the manifest, with the elements it declares. */
export type ManifestModule = {
  /** The module's path, from the package's folder (`src/my-button.ts`). */
  readonly path: string;
  /** The module's own description; empty when it has none. */
  readonly description: string;
  /** The custom elements it declares. */
  readonly elements: readonly ManifestElement[];
};

/** A package's manifest, read. */
export type Manifest = {
  /** The manifest's file, absolute. */
  readonly file: string;
  /** The package's folder, which the modules' paths start from. */
  readonly packageDir: string;
  /** Its modules. */
  readonly modules: readonly ManifestModule[];
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A list's records; nothing for a value that is no list. */
const recordsOf = (value: unknown): Readonly<Record<string, unknown>>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

/** A text field, or none. */
const textOf = (record: Readonly<Record<string, unknown>>, name: string): string | undefined => {
  const value = record[name];
  return typeof value === "string" ? value : undefined;
};

/** A type field, or none. */
const typeOf = (record: Readonly<Record<string, unknown>>): ManifestType | undefined => {
  const type = record["type"];
  return isRecord(type) && typeof type["text"] === "string" ? { text: type["text"] } : undefined;
};

/**
 * What every described part has: a name and a description (the summary when the description is missing).
 *
 * @param record - the part.
 * @returns the name and description, or none for a part with no name.
 */
const describedOf = (record: Readonly<Record<string, unknown>>): Described | undefined => {
  const name = textOf(record, "name");
  if (name === undefined) return undefined;
  return { name, description: textOf(record, "description") ?? textOf(record, "summary") ?? "" };
};

/** The described parts of a list, those with no name left out. */
const describedList = (value: unknown): Described[] =>
  recordsOf(value).flatMap((record) => {
    const described = describedOf(record);
    return described === undefined ? [] : [described];
  });

/**
 * A class declaration's public instance fields.
 *
 * @param members - its `members`.
 */
const fieldsOf = (members: unknown): ManifestField[] =>
  recordsOf(members).flatMap((record): ManifestField[] => {
    const described = describedOf(record);
    const privacy = textOf(record, "privacy");
    const isPublic = privacy === undefined || privacy === "public";
    if (described === undefined || record["kind"] !== "field" || record["static"] === true || !isPublic)
      return [];
    return [
      {
        ...described,
        type: typeOf(record),
        default: textOf(record, "default"),
        attribute: textOf(record, "attribute"),
        isReadonly: record["readonly"] === true
      }
    ];
  });

/**
 * A class declaration, when it is a custom element.
 *
 * @param record - the declaration.
 */
const elementOf = (record: Readonly<Record<string, unknown>>): ManifestElement | undefined => {
  const described = describedOf(record);
  const tagName = textOf(record, "tagName");
  if (described === undefined || record["kind"] !== "class") return undefined;
  if (record["customElement"] !== true && tagName === undefined) return undefined;
  const deprecated = record["deprecated"];
  return {
    ...described,
    tagName,
    summary: textOf(record, "summary") ?? "",
    deprecated: deprecated === true || typeof deprecated === "string" ? deprecated : undefined,
    attributes: recordsOf(record["attributes"]).flatMap((attribute): ManifestAttribute[] => {
      const each = describedOf(attribute);
      return each === undefined
        ? []
        : [
            {
              ...each,
              type: typeOf(attribute),
              default: textOf(attribute, "default"),
              fieldName: textOf(attribute, "fieldName")
            }
          ];
    }),
    fields: fieldsOf(record["members"]),
    events: recordsOf(record["events"]).flatMap((event): ManifestEvent[] => {
      const each = describedOf(event);
      return each === undefined ? [] : [{ ...each, type: typeOf(event) }];
    }),
    slots: describedList(record["slots"]),
    cssParts: describedList(record["cssParts"])
  };
};

/**
 * A manifest's modules, read from its parsed JSON.
 *
 * @param json - the manifest's content.
 */
export const manifestModules = (json: unknown): ManifestModule[] =>
  isRecord(json)
    ? recordsOf(json["modules"]).flatMap((module): ManifestModule[] => {
        const path = textOf(module, "path");
        if (path === undefined) return [];
        const elements = recordsOf(module["declarations"]).flatMap((declaration) => {
          const element = elementOf(declaration);
          return element === undefined ? [] : [element];
        });
        return [
          { path, description: textOf(module, "description") ?? textOf(module, "summary") ?? "", elements }
        ];
      })
    : [];

/**
 * A path a package's files name, inside the package: a manifest names its modules and a `package.json` its manifest, and
 * neither may lead the docs to a file outside it.
 *
 * @param packageDir - the package's folder.
 * @param path - the path, from the package's folder.
 * @returns the absolute path, or none for one that leaves the package.
 */
export const insidePackage = (packageDir: string, path: string): string | undefined => {
  const file = resolve(packageDir, path);
  const fromPackage = relative(packageDir, file);
  return fromPackage === "" || fromPackage.startsWith("..") || isAbsolute(fromPackage) ? undefined : file;
};

/** The manifests read, by file, with the time their file was last changed. */
const read = new Map<string, { readonly changed: number; readonly manifest: Manifest | string }>();

/**
 * The file of the nearest `package.json` above a folder.
 *
 * @param folder - the folder to start from.
 */
const packageJsonAbove = (folder: string): string | undefined => {
  const file = join(folder, "package.json");
  if (existsSync(file)) return file;
  const parent = dirname(folder);
  return parent === folder ? undefined : packageJsonAbove(parent);
};

/**
 * The manifest a package names, or the one beside its `package.json`.
 *
 * @param packageJson - the package's `package.json`.
 * @returns the manifest's file, absolute, or none when the package has none.
 */
const manifestFileOf = (packageJson: string): string | undefined => {
  const packageDir = dirname(packageJson);
  let named: unknown;
  try {
    const parsed: unknown = JSON.parse(readFileSync(packageJson, "utf8"));
    named = isRecord(parsed) ? parsed["customElements"] : undefined;
  } catch {
    named = undefined;
  }
  const file = insidePackage(packageDir, typeof named === "string" ? named : "custom-elements.json");
  return file !== undefined && existsSync(file) ? file : undefined;
};

/**
 * The manifest of the package a file is in.
 *
 * @param file - a file of the package, absolute (a story file).
 * @returns the manifest; none when the package has none; a message when it cannot be read.
 */
export const manifestFor = (file: string): Manifest | string | undefined => {
  const packageJson = packageJsonAbove(dirname(file));
  const manifestFile = packageJson === undefined ? undefined : manifestFileOf(packageJson);
  if (packageJson === undefined || manifestFile === undefined) return undefined;
  const changed = statSync(manifestFile).mtimeMs;
  const kept = read.get(manifestFile);
  if (kept?.changed === changed) return kept.manifest;
  let manifest: Manifest | string;
  try {
    const json: unknown = JSON.parse(readFileSync(manifestFile, "utf8"));
    manifest = { file: manifestFile, packageDir: dirname(packageJson), modules: manifestModules(json) };
  } catch (error) {
    manifest = `${manifestFile} could not be read: ${error instanceof Error ? error.message : String(error)}`;
  }
  read.set(manifestFile, { changed, manifest });
  return manifest;
};
