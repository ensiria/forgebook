/**
 * The types of the `?forgebook-files` and `?forgebook-markdown` imports, for the module that declares a source: add
 * `@forgebook/story-format/client` to that folder's `compilerOptions.types`, beside `vite/client`.
 *
 * @remarks
 * A script, not a module (no top-level import or export), so the wildcard declaration is global; the catalogue's Vite
 * plugin answers each import with one module (D-438).
 *
 * @module
 */

declare module "*?forgebook-files" {
  /** The story files the pattern before `?forgebook-files` matches. */
  const files: import("./source").StoryFiles;
  // the source imports the files as a default (`import files from "…?forgebook-files"`), so the module has one
  // biome-ignore lint/style/noDefaultExport: see above
  export default files;
}

declare module "*?forgebook-markdown" {
  /** The Markdown file before `?forgebook-markdown`, as HTML (the source's introduction on the catalogue's home). */
  const markdown: import("./source").StoryMarkdown;
  // the source imports it as a default (`() => import("./home.md?forgebook-markdown")`), so the module has one
  // biome-ignore lint/style/noDefaultExport: see above
  export default markdown;
}
