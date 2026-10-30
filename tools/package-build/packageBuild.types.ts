/**
 * The published manifest's fields the package build makes: pnpm's `publishConfig`, which replaces `exports` and `bin`
 * in the package published to npm.
 *
 * @module
 */

/** One published export: types and JavaScript for a module, types only for a declaration, a path for any other file. */
export type PublishedTarget = string | { readonly types: string; readonly default?: string };

/** The `publishConfig` of a package's `package.json`. */
export type PublishConfig = {
  /** Published for anyone to install (a scoped package is private by default). */
  readonly access: "public";
  /** The published `exports`, subpath to target. */
  readonly exports: Readonly<Record<string, PublishedTarget>>;
  /** The published `bin`, command to its built file; left out for a package without commands. */
  readonly bin?: Readonly<Record<string, string>>;
};
